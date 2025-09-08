// Real-time Market Data Manager
// Handles WebSocket connections for near real-time updates

export interface RealtimeQuote {
  symbol: string
  price: number
  volume: number
  timestamp: number
  change?: number
  changePercent?: string
}

export interface RealtimeConfig {
  provider: 'finnhub' | 'twelve_data' | 'polling'
  symbols: string[]
  onQuote: (quote: RealtimeQuote) => void
  onError?: (error: Error) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export class RealtimeManager {
  private connections: Map<string, WebSocket> = new Map()
  private reconnectTimers: Map<string, any> = new Map()
  private subscribedSymbols: Set<string> = new Set()
  private lastPrices: Map<string, number> = new Map()
  
  constructor(private env: any) {}

  // Initialize real-time connections based on available APIs
  async initializeRealtime(config: RealtimeConfig): Promise<void> {
    const { provider, symbols, onQuote, onError, onConnect, onDisconnect } = config
    
    switch (provider) {
      case 'finnhub':
        await this.connectFinnhub(symbols, onQuote, onError, onConnect, onDisconnect)
        break
      case 'twelve_data':
        await this.connectTwelveData(symbols, onQuote, onError, onConnect, onDisconnect)
        break
      default:
        // Fallback to polling for unsupported providers
        this.startPolling(symbols, onQuote, onError)
    }
  }

  // Finnhub WebSocket implementation
  private async connectFinnhub(
    symbols: string[],
    onQuote: (quote: RealtimeQuote) => void,
    onError?: (error: Error) => void,
    onConnect?: () => void,
    onDisconnect?: () => void
  ) {
    const apiKey = this.env.FINNHUB_API_KEY
    if (!apiKey) {
      onError?.(new Error('Finnhub API key not configured'))
      return
    }

    try {
      const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`)
      
      ws.onopen = () => {
        console.log('Finnhub WebSocket connected')
        onConnect?.()
        
        // Subscribe to symbols
        symbols.forEach(symbol => {
          ws.send(JSON.stringify({ type: 'subscribe', symbol }))
          this.subscribedSymbols.add(symbol)
        })
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'trade') {
            data.data?.forEach((trade: any) => {
              const lastPrice = this.lastPrices.get(trade.s) || trade.p
              const change = trade.p - lastPrice
              const changePercent = lastPrice ? ((change / lastPrice) * 100).toFixed(2) + '%' : '0%'
              
              onQuote({
                symbol: trade.s,
                price: trade.p,
                volume: trade.v,
                timestamp: trade.t,
                change,
                changePercent
              })
              
              this.lastPrices.set(trade.s, trade.p)
            })
          }
        } catch (error) {
          console.error('Error parsing Finnhub message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('Finnhub WebSocket error:', error)
        onError?.(new Error('Finnhub connection error'))
      }

      ws.onclose = () => {
        console.log('Finnhub WebSocket disconnected')
        onDisconnect?.()
        
        // Attempt reconnection after 5 seconds
        this.scheduleReconnect('finnhub', () => {
          this.connectFinnhub(symbols, onQuote, onError, onConnect, onDisconnect)
        })
      }

      this.connections.set('finnhub', ws)
    } catch (error) {
      console.error('Failed to connect to Finnhub:', error)
      onError?.(error as Error)
    }
  }

  // Twelve Data WebSocket implementation
  private async connectTwelveData(
    symbols: string[],
    onQuote: (quote: RealtimeQuote) => void,
    onError?: (error: Error) => void,
    onConnect?: () => void,
    onDisconnect?: () => void
  ) {
    const apiKey = this.env.TWELVE_DATA_API_KEY
    if (!apiKey) {
      onError?.(new Error('Twelve Data API key not configured'))
      return
    }

    try {
      const ws = new WebSocket('wss://ws.twelvedata.com/v1/quotes/price')
      
      ws.onopen = () => {
        console.log('Twelve Data WebSocket connected')
        onConnect?.()
        
        // Send authentication and subscribe
        ws.send(JSON.stringify({
          action: 'auth',
          params: { apikey: apiKey }
        }))
        
        setTimeout(() => {
          ws.send(JSON.stringify({
            action: 'subscribe',
            params: {
              symbols: symbols.join(',')
            }
          }))
          
          symbols.forEach(symbol => this.subscribedSymbols.add(symbol))
        }, 1000)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.event === 'price') {
            const lastPrice = this.lastPrices.get(data.symbol) || data.price
            const change = data.price - lastPrice
            const changePercent = lastPrice ? ((change / lastPrice) * 100).toFixed(2) + '%' : '0%'
            
            onQuote({
              symbol: data.symbol,
              price: parseFloat(data.price),
              volume: data.day_volume || 0,
              timestamp: data.timestamp || Date.now(),
              change,
              changePercent
            })
            
            this.lastPrices.set(data.symbol, data.price)
          }
        } catch (error) {
          console.error('Error parsing Twelve Data message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('Twelve Data WebSocket error:', error)
        onError?.(new Error('Twelve Data connection error'))
      }

      ws.onclose = () => {
        console.log('Twelve Data WebSocket disconnected')
        onDisconnect?.()
        
        // Attempt reconnection after 5 seconds
        this.scheduleReconnect('twelve_data', () => {
          this.connectTwelveData(symbols, onQuote, onError, onConnect, onDisconnect)
        })
      }

      this.connections.set('twelve_data', ws)
    } catch (error) {
      console.error('Failed to connect to Twelve Data:', error)
      onError?.(error as Error)
    }
  }

  // Polling fallback for non-WebSocket APIs
  private startPolling(
    symbols: string[],
    onQuote: (quote: RealtimeQuote) => void,
    onError?: (error: Error) => void
  ) {
    // Poll every 5 seconds for near real-time updates
    const pollInterval = setInterval(async () => {
      for (const symbol of symbols) {
        try {
          const quote = await this.fetchQuote(symbol)
          if (quote) {
            onQuote(quote)
          }
        } catch (error) {
          console.error(`Polling error for ${symbol}:`, error)
          onError?.(error as Error)
        }
      }
    }, 5000) // 5 second intervals for near real-time

    // Store interval for cleanup
    this.reconnectTimers.set('polling', pollInterval)
  }

  // Fetch quote for polling mode
  private async fetchQuote(symbol: string): Promise<RealtimeQuote | null> {
    // This would use the existing API manager to fetch quotes
    // Simplified for demonstration
    return null
  }

  // Schedule reconnection with exponential backoff
  private scheduleReconnect(provider: string, reconnectFn: () => void) {
    // Clear existing timer if any
    const existingTimer = this.reconnectTimers.get(provider)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Schedule reconnection
    const timer = setTimeout(() => {
      console.log(`Attempting to reconnect to ${provider}...`)
      reconnectFn()
    }, 5000) // 5 seconds delay

    this.reconnectTimers.set(provider, timer)
  }

  // Subscribe to additional symbols
  async subscribe(symbols: string[]) {
    symbols.forEach(symbol => {
      if (!this.subscribedSymbols.has(symbol)) {
        // Send subscribe message to all active connections
        this.connections.forEach((ws, provider) => {
          if (ws.readyState === WebSocket.OPEN) {
            if (provider === 'finnhub') {
              ws.send(JSON.stringify({ type: 'subscribe', symbol }))
            } else if (provider === 'twelve_data') {
              ws.send(JSON.stringify({
                action: 'subscribe',
                params: { symbols: symbol }
              }))
            }
          }
        })
        
        this.subscribedSymbols.add(symbol)
      }
    })
  }

  // Unsubscribe from symbols
  async unsubscribe(symbols: string[]) {
    symbols.forEach(symbol => {
      if (this.subscribedSymbols.has(symbol)) {
        // Send unsubscribe message to all active connections
        this.connections.forEach((ws, provider) => {
          if (ws.readyState === WebSocket.OPEN) {
            if (provider === 'finnhub') {
              ws.send(JSON.stringify({ type: 'unsubscribe', symbol }))
            } else if (provider === 'twelve_data') {
              ws.send(JSON.stringify({
                action: 'unsubscribe',
                params: { symbols: symbol }
              }))
            }
          }
        })
        
        this.subscribedSymbols.delete(symbol)
      }
    })
  }

  // Disconnect all WebSocket connections
  disconnect() {
    // Close all connections
    this.connections.forEach((ws, provider) => {
      console.log(`Closing ${provider} connection`)
      ws.close()
    })
    this.connections.clear()

    // Clear all timers
    this.reconnectTimers.forEach(timer => {
      clearTimeout(timer)
    })
    this.reconnectTimers.clear()

    // Clear subscriptions
    this.subscribedSymbols.clear()
    this.lastPrices.clear()
  }

  // Get connection status
  getStatus(): Record<string, string> {
    const status: Record<string, string> = {}
    
    this.connections.forEach((ws, provider) => {
      status[provider] = ws.readyState === WebSocket.OPEN ? 'connected' : 
                        ws.readyState === WebSocket.CONNECTING ? 'connecting' : 
                        'disconnected'
    })
    
    return status
  }
}