import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database
  CACHE: KVNamespace
  TWELVE_DATA_API_KEY: string
  FINNHUB_API_KEY?: string
  RAPIDAPI_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Helper function to fetch stock data using Twelve Data API
async function fetchStockData(symbol: string, env: Bindings): Promise<any> {
  const cacheKey = `stock:${symbol}`
  const cached = await env.CACHE.get(cacheKey, 'json')
  
  if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
    return cached.data
  }

  try {
    // Using Twelve Data API for real-time quotes
    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${env.TWELVE_DATA_API_KEY}`
    )
    const data = await response.json()
    
    if (data && data.symbol && !data.code) {
      const stockData = {
        symbol: data.symbol,
        name: data.name || symbol,
        price: parseFloat(data.close || data.price || 0),
        change: parseFloat(data.change || 0),
        changePercent: data.percent_change || '0%',
        volume: parseInt(data.volume || 0),
        latestTradingDay: data.datetime || new Date().toISOString().split('T')[0],
        previousClose: parseFloat(data.previous_close || 0),
        open: parseFloat(data.open || 0),
        high: parseFloat(data.high || 0),
        low: parseFloat(data.low || 0),
        exchange: data.exchange,
        currency: data.currency
      }
      
      await env.CACHE.put(cacheKey, JSON.stringify({
        data: stockData,
        timestamp: Date.now()
      }), { expirationTtl: 300 }) // 5 minutes TTL
      
      return stockData
    }
  } catch (error) {
    console.error('Error fetching stock data from Twelve Data:', error)
  }
  
  // Fallback to demo data if API fails
  const demoData: Record<string, any> = {
    'AAPL': { price: 195.89, change: 2.45, changePercent: '1.27%', open: 193.50, high: 196.20, low: 193.30, volume: 54233421, previousClose: 193.44 },
    'MSFT': { price: 415.26, change: -3.18, changePercent: '-0.76%', open: 418.50, high: 419.00, low: 414.80, volume: 21456789, previousClose: 418.44 },
    'GOOGL': { price: 139.52, change: 1.23, changePercent: '0.89%', open: 138.30, high: 140.10, low: 138.00, volume: 18234567, previousClose: 138.29 },
    'AMZN': { price: 178.35, change: 3.67, changePercent: '2.10%', open: 175.00, high: 179.00, low: 174.50, volume: 41234567, previousClose: 174.68 },
    'TSLA': { price: 251.44, change: -5.22, changePercent: '-2.03%', open: 256.00, high: 257.50, low: 250.80, volume: 89234567, previousClose: 256.66 },
    'NVDA': { price: 875.28, change: 12.45, changePercent: '1.44%', open: 863.00, high: 878.00, low: 862.00, volume: 34567890, previousClose: 862.83 },
    'META': { price: 483.59, change: 7.89, changePercent: '1.66%', open: 476.00, high: 485.00, low: 475.50, volume: 12345678, previousClose: 475.70 },
    'SPY': { price: 452.16, change: 1.23, changePercent: '0.27%', open: 451.00, high: 453.00, low: 450.50, volume: 78234567, previousClose: 450.93 },
    'QQQ': { price: 440.37, change: 2.45, changePercent: '0.56%', open: 438.00, high: 441.00, low: 437.50, volume: 34567890, previousClose: 437.92 }
  }

  if (demoData[symbol.toUpperCase()]) {
    const stockData = {
      symbol: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      ...demoData[symbol.toUpperCase()],
      latestTradingDay: new Date().toISOString().split('T')[0]
    }
    
    return stockData
  }
  
  return null
}

// Helper function to search stocks using Twelve Data
async function searchStocks(query: string, env: Bindings): Promise<any[]> {
  try {
    // Twelve Data symbol search endpoint
    const response = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${env.TWELVE_DATA_API_KEY}`
    )
    const data = await response.json()
    
    if (data && data.data && Array.isArray(data.data)) {
      return data.data.map((item: any) => ({
        symbol: item.symbol,
        name: item.instrument_name,
        type: item.instrument_type?.toLowerCase() || 'stock',
        exchange: item.exchange,
        currency: item.currency,
        country: item.country
      }))
    }
  } catch (error) {
    console.error('Error searching stocks:', error)
  }
  
  return []
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
    
    // If we have local results, return them
    if (results.results.length > 0) {
      return c.json({ results: results.results })
    }
    
    // Search using Twelve Data API
    const apiResults = await searchStocks(query, env)
    if (apiResults.length > 0) {
      return c.json({ results: apiResults })
    }
    
    // Fallback: return popular stocks that match the query
    const fallbackStocks = [
      { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', exchange: 'NASDAQ' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', exchange: 'NASDAQ' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', exchange: 'NASDAQ' },
      { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', exchange: 'NASDAQ' },
      { symbol: 'META', name: 'Meta Platforms Inc.', type: 'stock', exchange: 'NASDAQ' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', exchange: 'NASDAQ' },
      { symbol: 'JPM', name: 'JPMorgan Chase & Co.', type: 'stock', exchange: 'NYSE' },
      { symbol: 'V', name: 'Visa Inc.', type: 'stock', exchange: 'NYSE' },
      { symbol: 'WMT', name: 'Walmart Inc.', type: 'stock', exchange: 'NYSE' },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf', exchange: 'NYSE' },
      { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', exchange: 'NASDAQ' },
      { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'etf', exchange: 'NYSE' }
    ]
    
    const matchedStocks = fallbackStocks.filter(stock => 
      stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
      stock.name.toLowerCase().includes(query.toLowerCase())
    )
    
    if (matchedStocks.length > 0) {
      return c.json({ results: matchedStocks })
    }
    
    // If still no matches, return some popular stocks as suggestions
    return c.json({ 
      results: fallbackStocks.slice(0, 5),
      message: 'Showing popular stocks.'
    })
  } catch (error) {
    console.error('Search error:', error)
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
        `).bind(symbol, freshData.name || symbol, freshData.price).run()
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
      `).bind(symbol, stockData.name || symbol, stockData.price).run()
      
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
      `).bind(symbol, stockData.name || symbol, stockData.price).run()
      
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
      // Add small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
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