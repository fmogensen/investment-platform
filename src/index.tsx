import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database
  CACHE: KVNamespace
  ALPHA_VANTAGE_API_KEY: string
  FINNHUB_API_KEY?: string
  RAPIDAPI_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Helper function to fetch stock data with caching
async function fetchStockData(symbol: string, env: Bindings): Promise<any> {
  const cacheKey = `stock:${symbol}`
  const cached = await env.CACHE.get(cacheKey, 'json')
  
  if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
    return cached.data
  }

  try {
    // Using Alpha Vantage API
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${env.ALPHA_VANTAGE_API_KEY}`
    )
    const data = await response.json()
    
    if (data['Global Quote']) {
      const stockData = {
        symbol: data['Global Quote']['01. symbol'],
        price: parseFloat(data['Global Quote']['05. price']),
        change: parseFloat(data['Global Quote']['09. change']),
        changePercent: data['Global Quote']['10. change percent'],
        volume: parseInt(data['Global Quote']['06. volume']),
        latestTradingDay: data['Global Quote']['07. latest trading day'],
        previousClose: parseFloat(data['Global Quote']['08. previous close']),
        open: parseFloat(data['Global Quote']['02. open']),
        high: parseFloat(data['Global Quote']['03. high']),
        low: parseFloat(data['Global Quote']['04. low'])
      }
      
      await env.CACHE.put(cacheKey, JSON.stringify({
        data: stockData,
        timestamp: Date.now()
      }), { expirationTtl: 300 }) // 5 minutes TTL
      
      return stockData
    }
  } catch (error) {
    console.error('Error fetching stock data:', error)
  }
  
  return null
}

// API Routes

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

// Search stocks/ETFs
app.get('/api/search', async (c) => {
  const { env } = c
  const query = c.req.query('q')
  
  if (!query) {
    return c.json({ error: 'Query parameter required' }, 400)
  }
  
  try {
    // Search in local database first
    const results = await env.DB.prepare(`
      SELECT * FROM securities 
      WHERE symbol LIKE ? OR name LIKE ?
      LIMIT 10
    `).bind(`%${query}%`, `%${query}%`).all()
    
    // If no local results, search via API
    if (results.results.length === 0 && env.ALPHA_VANTAGE_API_KEY) {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${env.ALPHA_VANTAGE_API_KEY}`
      )
      const data = await response.json()
      
      if (data.bestMatches) {
        return c.json({
          results: data.bestMatches.map((match: any) => ({
            symbol: match['1. symbol'],
            name: match['2. name'],
            type: match['3. type'],
            region: match['4. region'],
            currency: match['8. currency']
          }))
        })
      }
    }
    
    return c.json({ results: results.results })
  } catch (error) {
    return c.json({ error: 'Search failed' }, 500)
  }
})

// Get stock quote
app.get('/api/quote/:symbol', async (c) => {
  const { env } = c
  const symbol = c.req.param('symbol').toUpperCase()
  
  try {
    // Check database first
    const dbStock = await env.DB.prepare(`
      SELECT * FROM securities WHERE symbol = ?
    `).bind(symbol).first()
    
    // Fetch fresh data from API
    const freshData = await fetchStockData(symbol, env)
    
    if (freshData) {
      // Update database with fresh data
      if (dbStock) {
        await env.DB.prepare(`
          UPDATE securities 
          SET last_price = ?, last_updated = CURRENT_TIMESTAMP
          WHERE symbol = ?
        `).bind(freshData.price, symbol).run()
      } else {
        // Insert new security
        await env.DB.prepare(`
          INSERT INTO securities (symbol, name, type, last_price)
          VALUES (?, ?, 'stock', ?)
        `).bind(symbol, symbol, freshData.price).run()
      }
      
      return c.json(freshData)
    }
    
    if (dbStock) {
      return c.json(dbStock)
    }
    
    return c.json({ error: 'Stock not found' }, 404)
  } catch (error) {
    return c.json({ error: 'Failed to fetch quote' }, 500)
  }
})

// Add to portfolio (buy)
app.post('/api/portfolio/:id/buy', async (c) => {
  const { env } = c
  const portfolioId = c.req.param('id')
  const { symbol, quantity, price } = await c.req.json()
  
  try {
    // Get or create security
    let security = await env.DB.prepare(`
      SELECT * FROM securities WHERE symbol = ?
    `).bind(symbol).first()
    
    if (!security) {
      // Fetch data and create security
      const stockData = await fetchStockData(symbol, env)
      if (!stockData) {
        return c.json({ error: 'Invalid symbol' }, 400)
      }
      
      const result = await env.DB.prepare(`
        INSERT INTO securities (symbol, name, type, last_price)
        VALUES (?, ?, 'stock', ?)
      `).bind(symbol, symbol, stockData.price).run()
      
      security = { id: result.meta.last_row_id, symbol, last_price: stockData.price }
    }
    
    // Check if holding exists
    const existingHolding = await env.DB.prepare(`
      SELECT * FROM holdings 
      WHERE portfolio_id = ? AND security_id = ?
    `).bind(portfolioId, security.id).first()
    
    if (existingHolding) {
      // Update existing holding (average cost calculation)
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
    // Get or create security
    let security = await env.DB.prepare(`
      SELECT * FROM securities WHERE symbol = ?
    `).bind(symbol).first()
    
    if (!security) {
      const stockData = await fetchStockData(symbol, env)
      if (!stockData) {
        return c.json({ error: 'Invalid symbol' }, 400)
      }
      
      const result = await env.DB.prepare(`
        INSERT INTO securities (symbol, name, type, last_price)
        VALUES (?, ?, 'stock', ?)
      `).bind(symbol, symbol, stockData.price).run()
      
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

// Batch update prices
app.post('/api/update-prices', async (c) => {
  const { env } = c
  
  try {
    // Get all unique securities in portfolios
    const securities = await env.DB.prepare(`
      SELECT DISTINCT s.* FROM securities s
      JOIN holdings h ON s.id = h.security_id
    `).all()
    
    const updates = []
    for (const security of securities.results) {
      const freshData = await fetchStockData(security.symbol, env)
      if (freshData) {
        updates.push(env.DB.prepare(`
          UPDATE securities 
          SET last_price = ?, last_updated = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(freshData.price, security.id).run())
      }
    }
    
    await Promise.all(updates)
    
    return c.json({ 
      success: true, 
      message: `Updated ${updates.length} securities` 
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
        <title>Investment Platform - Stock & ETF Portfolio Manager</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div id="app"></div>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app