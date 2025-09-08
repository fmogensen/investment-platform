// API Manager - Handles WebSocket-enabled stock market data providers only
// NO SAMPLE DATA - Always uses real API data

export interface StockQuote {
  symbol: string
  name?: string
  price: number
  change: number
  changePercent: string
  volume: number
  open: number
  high: number
  low: number
  previousClose: number
  latestTradingDay: string
  exchange?: string
  currency?: string
}

export interface SearchResult {
  symbol: string
  name: string
  type: string
  exchange?: string
  currency?: string
  country?: string
}

export class APIManager {
  private env: any
  private db: any
  private cache: any
  
  constructor(env: any) {
    this.env = env
    this.db = env.DB
    this.cache = env.CACHE
  }

  // Get active API provider configuration
  async getActiveProvider(): Promise<string> {
    const provider = await this.db.prepare(`
      SELECT name FROM api_providers 
      WHERE is_active = 1 AND is_default = 1 AND api_key IS NOT NULL
      AND name IN ('finnhub', 'twelve_data')
      LIMIT 1
    `).first()
    
    if (provider) return provider.name
    
    // Fallback order - only WebSocket-enabled providers
    const providers = ['finnhub', 'twelve_data']
    for (const p of providers) {
      if (this.getApiKey(p)) return p
    }
    
    throw new Error('No WebSocket-enabled API provider configured')
  }

  // Get API key for provider
  private getApiKey(provider: string): string | null {
    const keyMap: Record<string, string> = {
      'finnhub': this.env.FINNHUB_API_KEY,
      'twelve_data': this.env.TWELVE_DATA_API_KEY
    }
    return keyMap[provider] || null
  }

  // Track API usage
  async trackUsage(provider: string, endpoint: string, responseTime: number, statusCode: number, error?: string) {
    try {
      const providerId = await this.db.prepare(`
        SELECT id FROM api_providers WHERE name = ?
      `).bind(provider).first()
      
      if (providerId) {
        await this.db.prepare(`
          INSERT INTO api_usage (provider_id, endpoint, response_time, status_code, error_message)
          VALUES (?, ?, ?, ?, ?)
        `).bind(providerId.id, endpoint, responseTime, statusCode, error || null).run()
        
        await this.db.prepare(`
          UPDATE api_providers SET last_used = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(providerId.id).run()
      }
    } catch (e) {
      console.error('Failed to track API usage:', e)
    }
  }

  // Get stock quote with automatic provider selection
  async getQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `quote:${symbol}`
    const cached = await this.cache.get(cacheKey, 'json')
    
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data
    }

    const providers = await this.getProviderOrder()
    
    for (const provider of providers) {
      const startTime = Date.now()
      try {
        let quote = null
        
        switch (provider) {
          case 'twelve_data':
            quote = await this.getTwelveDataQuote(symbol)
            break
          case 'finnhub':
            quote = await this.getFinnhubQuote(symbol)
            break
        }
        
        if (quote) {
          await this.trackUsage(provider, 'quote', Date.now() - startTime, 200)
          await this.cache.put(cacheKey, JSON.stringify({
            data: quote,
            timestamp: Date.now()
          }), { expirationTtl: 300 })
          return quote
        }
      } catch (error) {
        await this.trackUsage(provider, 'quote', Date.now() - startTime, 500, error.message)
        console.error(`${provider} quote error:`, error)
      }
    }
    
    return null
  }

  // Search stocks with automatic provider selection
  async searchStocks(query: string): Promise<SearchResult[]> {
    const providers = await this.getProviderOrder()
    
    for (const provider of providers) {
      const startTime = Date.now()
      try {
        let results = []
        
        switch (provider) {
          case 'twelve_data':
            results = await this.searchTwelveData(query)
            break
          case 'finnhub':
            results = await this.searchFinnhub(query)
            break
        }
        
        if (results.length > 0) {
          await this.trackUsage(provider, 'search', Date.now() - startTime, 200)
          return results
        }
      } catch (error) {
        await this.trackUsage(provider, 'search', Date.now() - startTime, 500, error.message)
        console.error(`${provider} search error:`, error)
      }
    }
    
    return []
  }

  // Get provider order based on configuration
  private async getProviderOrder(): Promise<string[]> {
    const providers = []
    
    // Get default provider first
    try {
      const defaultProvider = await this.getActiveProvider()
      if (defaultProvider) providers.push(defaultProvider)
    } catch (e) {}
    
    // Add other WebSocket-enabled providers as fallback
    const allProviders = ['finnhub', 'twelve_data']
    for (const p of allProviders) {
      if (!providers.includes(p) && this.getApiKey(p)) {
        providers.push(p)
      }
    }
    
    return providers
  }

  // Twelve Data implementation (WebSocket supported)
  private async getTwelveDataQuote(symbol: string): Promise<StockQuote | null> {
    const apiKey = this.getApiKey('twelve_data')
    if (!apiKey) return null
    
    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${apiKey}`
    )
    const data = await response.json()
    
    if (data && data.symbol && !data.code) {
      return {
        symbol: data.symbol,
        name: data.name,
        price: parseFloat(data.close || data.price || 0),
        change: parseFloat(data.change || 0),
        changePercent: data.percent_change || '0%',
        volume: parseInt(data.volume || 0),
        open: parseFloat(data.open || 0),
        high: parseFloat(data.high || 0),
        low: parseFloat(data.low || 0),
        previousClose: parseFloat(data.previous_close || 0),
        latestTradingDay: data.datetime || new Date().toISOString().split('T')[0],
        exchange: data.exchange,
        currency: data.currency
      }
    }
    
    return null
  }

  private async searchTwelveData(query: string): Promise<SearchResult[]> {
    const apiKey = this.getApiKey('twelve_data')
    if (!apiKey) return []
    
    const response = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${apiKey}`
    )
    const data = await response.json()
    
    if (data && data.data && Array.isArray(data.data)) {
      return data.data.slice(0, 20).map((item: any) => ({
        symbol: item.symbol,
        name: item.instrument_name,
        type: item.instrument_type?.toLowerCase() || 'stock',
        exchange: item.exchange,
        currency: item.currency,
        country: item.country
      }))
    }
    
    return []
  }

  // Finnhub implementation (WebSocket supported)
  private async getFinnhubQuote(symbol: string): Promise<StockQuote | null> {
    const apiKey = this.getApiKey('finnhub')
    if (!apiKey) return null
    
    const [quoteRes, profileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`)
    ])
    
    const quote = await quoteRes.json()
    const profile = await profileRes.json()
    
    if (quote && quote.c > 0) {
      const change = quote.c - quote.pc
      const changePercent = ((change / quote.pc) * 100).toFixed(2)
      
      return {
        symbol: symbol.toUpperCase(),
        name: profile.name || symbol,
        price: quote.c,
        change: change,
        changePercent: `${changePercent}%`,
        volume: 0, // Finnhub doesn't provide volume in quote endpoint
        open: quote.o,
        high: quote.h,
        low: quote.l,
        previousClose: quote.pc,
        latestTradingDay: new Date(quote.t * 1000).toISOString().split('T')[0],
        exchange: profile.exchange,
        currency: profile.currency || 'USD'
      }
    }
    
    return null
  }

  private async searchFinnhub(query: string): Promise<SearchResult[]> {
    const apiKey = this.getApiKey('finnhub')
    if (!apiKey) return []
    
    const response = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`
    )
    const data = await response.json()
    
    if (data && data.result && Array.isArray(data.result)) {
      return data.result.slice(0, 20).map((item: any) => ({
        symbol: item.symbol,
        name: item.description,
        type: item.type?.toLowerCase() || 'stock',
        exchange: item.displaySymbol
      }))
    }
    
    return []
  }

  // Check WebSocket support for provider
  hasWebSocketSupport(provider: string): boolean {
    return ['finnhub', 'twelve_data'].includes(provider)
  }

  // Get WebSocket configuration for provider
  getWebSocketConfig(provider: string): any {
    const configs: Record<string, any> = {
      'finnhub': {
        url: 'wss://ws.finnhub.io',
        apiKey: this.getApiKey('finnhub'),
        supported: true
      },
      'twelve_data': {
        url: 'wss://ws.twelvedata.com/v1/quotes/price',
        apiKey: this.getApiKey('twelve_data'),
        supported: true
      }
    }
    
    return configs[provider] || { supported: false }
  }
}