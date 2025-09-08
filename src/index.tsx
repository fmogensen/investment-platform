import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { APIManager } from './api-manager'
import { RealtimeManager } from './realtime-manager'

type Bindings = {
  DB: D1Database
  CACHE: KVNamespace
  ALPHA_VANTAGE_API_KEY: string
  FINNHUB_API_KEY: string
  TWELVE_DATA_API_KEY: string
  RAPIDAPI_KEY?: string
  POLYGON_API_KEY?: string
  IEX_CLOUD_API_KEY?: string
  ADMIN_PASSWORD: string
  DEFAULT_API_PROVIDER: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Initialize API Manager
function getAPIManager(env: Bindings) {
  return new APIManager(env)
}

// Admin authentication middleware
async function verifyAdmin(password: string, env: Bindings): Promise<boolean> {
  return password === env.ADMIN_PASSWORD
}

// API Routes

// Admin: Get API configuration
app.get('/api/admin/config', async (c) => {
  const { env } = c
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !await verifyAdmin(authHeader.replace('Bearer ', ''), env)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const providers = await env.DB.prepare(`
      SELECT name, display_name, is_active, is_default, rate_limit, daily_limit, last_used,
        CASE WHEN api_key IS NOT NULL THEN 1 ELSE 0 END as has_key
      FROM api_providers
      ORDER BY is_default DESC, name
    `).all()
    
    const settings = await env.DB.prepare(`
      SELECT setting_key, setting_value, setting_type, description
      FROM admin_settings
    `).all()
    
    const usage = await env.DB.prepare(`
      SELECT 
        p.name as provider,
        COUNT(u.id) as total_requests,
        AVG(u.response_time) as avg_response_time,
        SUM(CASE WHEN u.status_code >= 400 THEN 1 ELSE 0 END) as error_count,
        MAX(u.created_at) as last_request
      FROM api_providers p
      LEFT JOIN api_usage u ON p.id = u.provider_id
      WHERE u.created_at >= datetime('now', '-24 hours')
      GROUP BY p.id
    `).all()
    
    return c.json({
      providers: providers.results,
      settings: settings.results,
      usage: usage.results,
      current_provider: env.DEFAULT_API_PROVIDER
    })
  } catch (error) {
    return c.json({ error: 'Failed to get configuration' }, 500)
  }
})

// Admin: Update API configuration
app.post('/api/admin/config', async (c) => {
  const { env } = c
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !await verifyAdmin(authHeader.replace('Bearer ', ''), env)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const { provider, apiKey, setDefault } = await c.req.json()
  
  try {
    // Update API key if provided
    if (apiKey !== undefined) {
      await env.DB.prepare(`
        UPDATE api_providers 
        SET api_key = ?, updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `).bind(apiKey || null, provider).run()
    }
    
    // Set as default if requested
    if (setDefault) {
      await env.DB.prepare(`UPDATE api_providers SET is_default = 0`).run()
      await env.DB.prepare(`
        UPDATE api_providers 
        SET is_default = 1, is_active = 1, updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `).bind(provider).run()
    }
    
    return c.json({ success: true, message: 'Configuration updated' })
  } catch (error) {
    return c.json({ error: 'Failed to update configuration' }, 500)
  }
})

// Admin: Update settings
app.post('/api/admin/settings', async (c) => {
  const { env } = c
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !await verifyAdmin(authHeader.replace('Bearer ', ''), env)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const settings = await c.req.json()
  
  try {
    for (const [key, value] of Object.entries(settings)) {
      await env.DB.prepare(`
        UPDATE admin_settings 
        SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE setting_key = ?
      `).bind(String(value), key).run()
    }
    
    return c.json({ success: true, message: 'Settings updated' })
  } catch (error) {
    return c.json({ error: 'Failed to update settings' }, 500)
  }
})

// Admin: Test API provider
app.post('/api/admin/test-api', async (c) => {
  const { env } = c
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !await verifyAdmin(authHeader.replace('Bearer ', ''), env)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const { provider, symbol = 'AAPL' } = await c.req.json()
  
  try {
    const apiManager = getAPIManager(env)
    const startTime = Date.now()
    
    // Force specific provider for testing
    const originalProvider = env.DEFAULT_API_PROVIDER
    env.DEFAULT_API_PROVIDER = provider
    
    const quote = await apiManager.getQuote(symbol)
    const responseTime = Date.now() - startTime
    
    env.DEFAULT_API_PROVIDER = originalProvider
    
    if (quote) {
      return c.json({
        success: true,
        provider,
        responseTime,
        data: quote
      })
    } else {
      return c.json({
        success: false,
        provider,
        responseTime,
        error: 'Failed to fetch quote'
      })
    }
  } catch (error) {
    return c.json({
      success: false,
      provider,
      error: error.message
    })
  }
})

// Portfolio CRUD Operations

// Get all portfolios for the user
app.get('/api/portfolios', async (c) => {
  const { env } = c
  
  try {
    const portfolios = await env.DB.prepare(`
      SELECT p.*, 
        COUNT(DISTINCT h.security_id) as holdings_count,
        COALESCE(SUM(h.quantity * s.last_price), 0) as current_value,
        COALESCE(SUM(h.quantity * h.average_cost), 0) as total_cost
      FROM portfolios p
      LEFT JOIN holdings h ON p.id = h.portfolio_id
      LEFT JOIN securities s ON h.security_id = s.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all()
    
    return c.json({
      portfolios: portfolios.results || [],
      count: portfolios.results?.length || 0
    })
  } catch (error) {
    console.error('Failed to fetch portfolios:', error)
    return c.json({ error: 'Failed to fetch portfolios' }, 500)
  }
})

// Create a new portfolio
app.post('/api/portfolios', async (c) => {
  const { env } = c
  const { name, description } = await c.req.json()
  
  if (!name || name.trim() === '') {
    return c.json({ error: 'Portfolio name is required' }, 400)
  }
  
  try {
    const result = await env.DB.prepare(`
      INSERT INTO portfolios (name, description, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).bind(name.trim(), description || '').run()
    
    if (result.success && result.meta.last_row_id) {
      const portfolio = await env.DB.prepare(`
        SELECT * FROM portfolios WHERE id = ?
      `).bind(result.meta.last_row_id).first()
      
      return c.json({ 
        success: true, 
        portfolio,
        message: 'Portfolio created successfully'
      })
    }
    
    return c.json({ error: 'Failed to create portfolio' }, 500)
  } catch (error) {
    console.error('Failed to create portfolio:', error)
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'A portfolio with this name already exists' }, 409)
    }
    return c.json({ error: 'Failed to create portfolio' }, 500)
  }
})

// Update a portfolio
app.put('/api/portfolios/:id', async (c) => {
  const { env } = c
  const portfolioId = c.req.param('id')
  const { name, description } = await c.req.json()
  
  if (!name || name.trim() === '') {
    return c.json({ error: 'Portfolio name is required' }, 400)
  }
  
  try {
    // Check if portfolio exists
    const existing = await env.DB.prepare(`
      SELECT * FROM portfolios WHERE id = ?
    `).bind(portfolioId).first()
    
    if (!existing) {
      return c.json({ error: 'Portfolio not found' }, 404)
    }
    
    // Prevent modification of default portfolio name
    if (portfolioId === '1' && name !== 'Default Portfolio') {
      return c.json({ error: 'Cannot rename the default portfolio' }, 403)
    }
    
    const result = await env.DB.prepare(`
      UPDATE portfolios 
      SET name = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(name.trim(), description || '', portfolioId).run()
    
    if (result.success) {
      const portfolio = await env.DB.prepare(`
        SELECT * FROM portfolios WHERE id = ?
      `).bind(portfolioId).first()
      
      return c.json({ 
        success: true, 
        portfolio,
        message: 'Portfolio updated successfully'
      })
    }
    
    return c.json({ error: 'Failed to update portfolio' }, 500)
  } catch (error) {
    console.error('Failed to update portfolio:', error)
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'A portfolio with this name already exists' }, 409)
    }
    return c.json({ error: 'Failed to update portfolio' }, 500)
  }
})

// Delete a portfolio
app.delete('/api/portfolios/:id', async (c) => {
  const { env } = c
  const portfolioId = c.req.param('id')
  
  // Prevent deletion of default portfolio
  if (portfolioId === '1') {
    return c.json({ error: 'Cannot delete the default portfolio' }, 403)
  }
  
  try {
    // Check if portfolio exists
    const existing = await env.DB.prepare(`
      SELECT * FROM portfolios WHERE id = ?
    `).bind(portfolioId).first()
    
    if (!existing) {
      return c.json({ error: 'Portfolio not found' }, 404)
    }
    
    // Check if portfolio has holdings
    const holdings = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM holdings WHERE portfolio_id = ?
    `).bind(portfolioId).first()
    
    if (holdings.count > 0) {
      return c.json({ 
        error: 'Cannot delete portfolio with existing holdings. Please remove all holdings first.' 
      }, 409)
    }
    
    // Delete associated transactions first
    await env.DB.prepare(`
      DELETE FROM transactions WHERE portfolio_id = ?
    `).bind(portfolioId).run()
    
    // Delete the portfolio
    const result = await env.DB.prepare(`
      DELETE FROM portfolios WHERE id = ?
    `).bind(portfolioId).run()
    
    if (result.success) {
      return c.json({ 
        success: true, 
        message: 'Portfolio deleted successfully'
      })
    }
    
    return c.json({ error: 'Failed to delete portfolio' }, 500)
  } catch (error) {
    console.error('Failed to delete portfolio:', error)
    return c.json({ error: 'Failed to delete portfolio' }, 500)
  }
})

// Get portfolio summary
app.get('/api/portfolio/:id', async (c) => {
  const { env } = c
  const portfolioId = c.req.param('id')
  
  try {
    const portfolio = await env.DB.prepare(`
      SELECT p.*, 
        COUNT(DISTINCT h.security_id) as holdings_count,
        SUM(h.quantity * s.last_price) as current_value,
        SUM(h.quantity * h.average_cost) as total_cost
      FROM portfolios p
      LEFT JOIN holdings h ON p.id = h.portfolio_id
      LEFT JOIN securities s ON h.security_id = s.id
      WHERE p.id = ?
      GROUP BY p.id
    `).bind(portfolioId).first()
    
    if (!portfolio) {
      return c.json({ error: 'Portfolio not found' }, 404)
    }
    
    const holdings = await env.DB.prepare(`
      SELECT h.*, s.symbol, s.name, s.type, s.last_price,
        (h.quantity * s.last_price) as current_value,
        (h.quantity * h.average_cost) as cost_basis,
        ((h.quantity * s.last_price) - (h.quantity * h.average_cost)) as gain_loss,
        (((h.quantity * s.last_price) - (h.quantity * h.average_cost)) / (h.quantity * h.average_cost) * 100) as gain_loss_percent
      FROM holdings h
      JOIN securities s ON h.security_id = s.id
      WHERE h.portfolio_id = ?
      ORDER BY current_value DESC
    `).bind(portfolioId).all()
    
    return c.json({
      portfolio,
      holdings: holdings.results,
      summary: {
        totalValue: portfolio.current_value || 0,
        totalCost: portfolio.total_cost || 0,
        totalGainLoss: (portfolio.current_value || 0) - (portfolio.total_cost || 0),
        totalGainLossPercent: portfolio.total_cost ? 
          ((portfolio.current_value - portfolio.total_cost) / portfolio.total_cost * 100) : 0
      }
    })
  } catch (error) {
    return c.json({ error: 'Failed to fetch portfolio' }, 500)
  }
})

// Search stocks/ETFs - ALWAYS USE REAL API DATA
app.get('/api/search', async (c) => {
  const { env } = c
  const query = c.req.query('q')
  
  if (!query || query.length < 1) {
    return c.json({ error: 'Query parameter required' }, 400)
  }
  
  try {
    const apiManager = getAPIManager(env)
    
    // Always try to get real API data first
    const apiResults = await apiManager.searchStocks(query)
    
    if (apiResults && apiResults.length > 0) {
      return c.json({ results: apiResults })
    }
    
    // If API fails, check local database (but these are real stocks previously fetched)
    const dbResults = await env.DB.prepare(`
      SELECT symbol, name, type, exchange, currency FROM securities 
      WHERE symbol LIKE ? OR name LIKE ?
      LIMIT 20
    `).bind(`%${query}%`, `%${query}%`).all()
    
    if (dbResults.results.length > 0) {
      return c.json({ 
        results: dbResults.results,
        source: 'database',
        message: 'Showing previously fetched stocks. Check API configuration for live data.'
      })
    }
    
    return c.json({ 
      results: [],
      error: 'No results found. Please check API configuration in admin panel.'
    })
  } catch (error) {
    console.error('Search error:', error)
    return c.json({ error: 'Search failed. Please check API configuration.' }, 500)
  }
})

// Get stock quote - ALWAYS USE REAL API DATA
app.get('/api/quote/:symbol', async (c) => {
  const { env } = c
  const symbol = c.req.param('symbol').toUpperCase()
  
  try {
    const apiManager = getAPIManager(env)
    
    // Always fetch fresh data from API
    const freshData = await apiManager.getQuote(symbol)
    
    if (freshData) {
      // Update database with fresh data
      const dbStock = await env.DB.prepare(`
        SELECT id FROM securities WHERE symbol = ?
      `).bind(symbol).first()
      
      if (dbStock) {
        await env.DB.prepare(`
          UPDATE securities 
          SET last_price = ?, name = ?, last_updated = CURRENT_TIMESTAMP
          WHERE symbol = ?
        `).bind(freshData.price, freshData.name || symbol, symbol).run()
      } else {
        await env.DB.prepare(`
          INSERT INTO securities (symbol, name, type, last_price, exchange, currency)
          VALUES (?, ?, 'stock', ?, ?, ?)
        `).bind(
          symbol, 
          freshData.name || symbol, 
          freshData.price,
          freshData.exchange || 'UNKNOWN',
          freshData.currency || 'USD'
        ).run()
      }
      
      return c.json(freshData)
    }
    
    return c.json({ 
      error: 'Unable to fetch real-time quote. Please check API configuration in admin panel.' 
    }, 404)
  } catch (error) {
    console.error('Quote error:', error)
    return c.json({ error: 'Failed to fetch quote. Please check API configuration.' }, 500)
  }
})

// Add to portfolio (buy)
app.post('/api/portfolio/:id/buy', async (c) => {
  const { env } = c
  const portfolioId = c.req.param('id')
  const { symbol, quantity, price } = await c.req.json()
  
  try {
    const apiManager = getAPIManager(env)
    
    // Get or create security with REAL API data
    let security = await env.DB.prepare(`
      SELECT * FROM securities WHERE symbol = ?
    `).bind(symbol).first()
    
    if (!security) {
      // Fetch real data from API
      const stockData = await apiManager.getQuote(symbol)
      if (!stockData) {
        return c.json({ error: 'Invalid symbol - unable to verify with market data' }, 400)
      }
      
      const result = await env.DB.prepare(`
        INSERT INTO securities (symbol, name, type, last_price, exchange, currency)
        VALUES (?, ?, 'stock', ?, ?, ?)
      `).bind(
        symbol, 
        stockData.name || symbol,
        stockData.price,
        stockData.exchange || 'UNKNOWN',
        stockData.currency || 'USD'
      ).run()
      
      security = { id: result.meta.last_row_id, symbol, last_price: stockData.price }
    }
    
    // Check if holding exists
    const existingHolding = await env.DB.prepare(`
      SELECT * FROM holdings 
      WHERE portfolio_id = ? AND security_id = ?
    `).bind(portfolioId, security.id).first()
    
    if (existingHolding) {
      // Update existing holding
      const newQuantity = existingHolding.quantity + quantity
      const newAvgCost = ((existingHolding.quantity * existingHolding.average_cost) + (quantity * price)) / newQuantity
      
      await env.DB.prepare(`
        UPDATE holdings 
        SET quantity = ?, average_cost = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(newQuantity, newAvgCost, existingHolding.id).run()
    } else {
      // Create new holding
      await env.DB.prepare(`
        INSERT INTO holdings (portfolio_id, security_id, quantity, average_cost)
        VALUES (?, ?, ?, ?)
      `).bind(portfolioId, security.id, quantity, price).run()
    }
    
    // Record transaction
    await env.DB.prepare(`
      INSERT INTO transactions (portfolio_id, security_id, type, quantity, price, fees)
      VALUES (?, ?, 'buy', ?, ?, ?)
    `).bind(portfolioId, security.id, quantity, price, 0).run()
    
    return c.json({ success: true, message: 'Purchase completed' })
  } catch (error) {
    console.error('Buy error:', error)
    return c.json({ error: 'Transaction failed' }, 500)
  }
})

// Sell from portfolio
app.post('/api/portfolio/:id/sell', async (c) => {
  const { env } = c
  const portfolioId = c.req.param('id')
  const { symbol, quantity, price } = await c.req.json()
  
  try {
    // Get security
    const security = await env.DB.prepare(`
      SELECT * FROM securities WHERE symbol = ?
    `).bind(symbol).first()
    
    if (!security) {
      return c.json({ error: 'Security not found' }, 404)
    }
    
    // Get holding
    const holding = await env.DB.prepare(`
      SELECT * FROM holdings 
      WHERE portfolio_id = ? AND security_id = ?
    `).bind(portfolioId, security.id).first()
    
    if (!holding || holding.quantity < quantity) {
      return c.json({ error: 'Insufficient holdings' }, 400)
    }
    
    if (holding.quantity === quantity) {
      // Sell all - remove holding
      await env.DB.prepare(`
        DELETE FROM holdings WHERE id = ?
      `).bind(holding.id).run()
    } else {
      // Partial sell - update quantity
      await env.DB.prepare(`
        UPDATE holdings 
        SET quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(holding.quantity - quantity, holding.id).run()
    }
    
    // Record transaction
    await env.DB.prepare(`
      INSERT INTO transactions (portfolio_id, security_id, type, quantity, price, fees)
      VALUES (?, ?, 'sell', ?, ?, ?)
    `).bind(portfolioId, security.id, quantity, price, 0).run()
    
    return c.json({ 
      success: true, 
      message: 'Sale completed',
      profit: (price - holding.average_cost) * quantity
    })
  } catch (error) {
    return c.json({ error: 'Transaction failed' }, 500)
  }
})

// Get watchlist
app.get('/api/watchlist', async (c) => {
  const { env } = c
  
  try {
    const watchlist = await env.DB.prepare(`
      SELECT w.*, s.symbol, s.name, s.type, s.last_price
      FROM watchlist w
      JOIN securities s ON w.security_id = s.id
      WHERE w.user_id = 1
      ORDER BY w.created_at DESC
    `).all()
    
    return c.json({ watchlist: watchlist.results })
  } catch (error) {
    return c.json({ error: 'Failed to fetch watchlist' }, 500)
  }
})

// Add to watchlist
app.post('/api/watchlist', async (c) => {
  const { env } = c
  const { symbol, targetPrice, notes } = await c.req.json()
  
  try {
    const apiManager = getAPIManager(env)
    
    // Get or create security with REAL API data
    let security = await env.DB.prepare(`
      SELECT * FROM securities WHERE symbol = ?
    `).bind(symbol).first()
    
    if (!security) {
      const stockData = await apiManager.getQuote(symbol)
      if (!stockData) {
        return c.json({ error: 'Invalid symbol - unable to verify with market data' }, 400)
      }
      
      const result = await env.DB.prepare(`
        INSERT INTO securities (symbol, name, type, last_price, exchange, currency)
        VALUES (?, ?, 'stock', ?, ?, ?)
      `).bind(
        symbol,
        stockData.name || symbol,
        stockData.price,
        stockData.exchange || 'UNKNOWN',
        stockData.currency || 'USD'
      ).run()
      
      security = { id: result.meta.last_row_id }
    }
    
    await env.DB.prepare(`
      INSERT OR REPLACE INTO watchlist (user_id, security_id, target_price, notes)
      VALUES (1, ?, ?, ?)
    `).bind(security.id, targetPrice, notes).run()
    
    return c.json({ success: true, message: 'Added to watchlist' })
  } catch (error) {
    return c.json({ error: 'Failed to add to watchlist' }, 500)
  }
})

// Get transactions history
app.get('/api/transactions/:portfolioId', async (c) => {
  const { env } = c
  const portfolioId = c.req.param('portfolioId')
  
  try {
    const transactions = await env.DB.prepare(`
      SELECT t.*, s.symbol, s.name
      FROM transactions t
      JOIN securities s ON t.security_id = s.id
      WHERE t.portfolio_id = ?
      ORDER BY t.transaction_date DESC
      LIMIT 50
    `).bind(portfolioId).all()
    
    return c.json({ transactions: transactions.results })
  } catch (error) {
    return c.json({ error: 'Failed to fetch transactions' }, 500)
  }
})

// Server-Sent Events for real-time updates
app.get('/api/realtime', async (c) => {
  const { env } = c
  
  // Create a readable stream for SSE
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  
  // Start async processing
  const streamPromise = (async () => {
    try {
      // Send initial connection message
      await writer.write(encoder.encode(`data: {"type":"connected","timestamp":${Date.now()}}\n\n`))
      
      // Initialize API manager
      const apiManager = getAPIManager(env)
      
      // Get portfolio securities to track
      const securities = await env.DB.prepare(`
        SELECT DISTINCT s.symbol FROM securities s
        JOIN holdings h ON s.id = h.security_id
        LIMIT 20
      `).all()
      
      if (!securities.results || securities.results.length === 0) {
        await writer.write(encoder.encode(`data: {"type":"info","message":"No holdings to track"}\n\n`))
      }
      
      const symbols = securities.results?.map((s: any) => s.symbol) || []
      
      // Send updates every 3 seconds
      let updateCount = 0
      const intervalId = setInterval(async () => {
        try {
          updateCount++
          
          // Batch update symbols
          for (const symbol of symbols) {
            try {
              const quote = await apiManager.getQuote(symbol)
              if (quote) {
                const message = JSON.stringify({
                  type: 'quote',
                  symbol: symbol,
                  price: quote.price,
                  change: quote.change,
                  changePercent: quote.changePercent,
                  volume: quote.volume,
                  timestamp: Date.now()
                })
                
                await writer.write(encoder.encode(`data: ${message}\n\n`))
              }
            } catch (err) {
              console.error(`Error fetching quote for ${symbol}:`, err)
            }
            
            // Small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          
          // Send heartbeat every 10 updates
          if (updateCount % 10 === 0) {
            await writer.write(encoder.encode(`:heartbeat\n\n`))
          }
        } catch (error) {
          console.error('Update cycle error:', error)
        }
      }, 3000) // Update every 3 seconds
      
      // Keep stream open for 5 minutes max, then client should reconnect
      setTimeout(() => {
        clearInterval(intervalId)
        writer.close()
      }, 300000) // 5 minutes
      
      // Handle abort signal
      c.req.raw.signal?.addEventListener('abort', () => {
        clearInterval(intervalId)
        writer.close()
      })
      
    } catch (error) {
      console.error('SSE stream error:', error)
      try {
        await writer.write(encoder.encode(`data: {"type":"error","message":"Stream error: ${error.message}"}\n\n`))
      } catch (e) {}
      writer.close()
    }
  })()
  
  // Don't await the promise, let it run in background
  streamPromise.catch(console.error)
  
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable buffering for nginx
    }
  })
})

// Batch update prices - REAL API DATA ONLY
app.post('/api/update-prices', async (c) => {
  const { env } = c
  
  try {
    const apiManager = getAPIManager(env)
    
    // Get all unique securities in portfolios
    const securities = await env.DB.prepare(`
      SELECT DISTINCT s.* FROM securities s
      JOIN holdings h ON s.id = h.security_id
    `).all()
    
    const updates = []
    let successCount = 0
    let errorCount = 0
    
    for (const security of securities.results) {
      try {
        const freshData = await apiManager.getQuote(security.symbol)
        if (freshData) {
          await env.DB.prepare(`
            UPDATE securities 
            SET last_price = ?, last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(freshData.price, security.id).run()
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        console.error(`Failed to update ${security.symbol}:`, error)
        errorCount++
      }
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 150))
    }
    
    return c.json({ 
      success: true, 
      message: `Updated ${successCount} securities, ${errorCount} errors`,
      updated: successCount,
      errors: errorCount
    })
  } catch (error) {
    return c.json({ error: 'Failed to update prices' }, 500)
  }
})

// Main page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Investment Platform - Real-Time Stock & ETF Portfolio Manager</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div id="app"></div>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/realtime.js"></script>
        <script src="/static/portfolio-manager.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// Admin page
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin - API Configuration</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div id="adminApp"></div>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/admin.js"></script>
    </body>
    </html>
  `)
})

export default app