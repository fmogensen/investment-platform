// Real-time market data handler using Server-Sent Events

class RealtimeMarketData {
  constructor() {
    this.eventSource = null
    this.connected = false
    this.lastUpdate = null
    this.priceCache = new Map()
    this.updateCallbacks = []
    this.connectionRetries = 0
    this.maxRetries = 5
  }

  // Initialize real-time connection
  connect() {
    if (this.eventSource) {
      this.disconnect()
    }

    console.log('Connecting to real-time market data...')
    this.updateConnectionStatus('connecting')

    try {
      this.eventSource = new EventSource('/api/realtime')

      this.eventSource.onopen = () => {
        console.log('Real-time connection established')
        this.connected = true
        this.connectionRetries = 0
        this.updateConnectionStatus('connected')
      }

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleRealtimeData(data)
        } catch (error) {
          console.error('Error parsing real-time data:', error)
        }
      }

      this.eventSource.onerror = (error) => {
        console.error('Real-time connection error:', error)
        this.connected = false
        this.updateConnectionStatus('error')
        
        // Attempt reconnection with exponential backoff
        if (this.connectionRetries < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, this.connectionRetries), 30000)
          this.connectionRetries++
          
          console.log(`Reconnecting in ${delay / 1000} seconds... (attempt ${this.connectionRetries}/${this.maxRetries})`)
          setTimeout(() => this.connect(), delay)
        } else {
          console.error('Max reconnection attempts reached. Falling back to polling.')
          this.updateConnectionStatus('disconnected')
        }
      }
    } catch (error) {
      console.error('Failed to establish real-time connection:', error)
      this.updateConnectionStatus('error')
    }
  }

  // Handle incoming real-time data
  handleRealtimeData(data) {
    switch (data.type) {
      case 'connected':
        console.log('Real-time feed connected at', new Date(data.timestamp))
        break
        
      case 'quote':
        this.updateQuote(data)
        break
        
      case 'error':
        console.error('Real-time error:', data.message)
        break
    }
  }

  // Update quote data
  updateQuote(quote) {
    const { symbol, price, change, changePercent, volume, timestamp } = quote
    
    // Store in cache
    this.priceCache.set(symbol, {
      price,
      change,
      changePercent,
      volume,
      timestamp,
      lastUpdate: new Date()
    })
    
    this.lastUpdate = new Date()
    
    // Notify all callbacks
    this.updateCallbacks.forEach(callback => {
      try {
        callback(symbol, quote)
      } catch (error) {
        console.error('Error in update callback:', error)
      }
    })
    
    // Update UI elements
    this.updateUI(symbol, quote)
  }

  // Update UI with real-time data
  updateUI(symbol, quote) {
    // Update price in portfolio holdings table
    const priceElements = document.querySelectorAll(`[data-symbol="${symbol}"][data-field="price"]`)
    priceElements.forEach(el => {
      const oldPrice = parseFloat(el.textContent.replace('$', ''))
      el.textContent = `$${quote.price.toFixed(2)}`
      
      // Add flash effect for price changes
      if (oldPrice !== quote.price) {
        el.classList.remove('price-flash-up', 'price-flash-down')
        el.classList.add(quote.price > oldPrice ? 'price-flash-up' : 'price-flash-down')
        setTimeout(() => {
          el.classList.remove('price-flash-up', 'price-flash-down')
        }, 1000)
      }
    })
    
    // Update change elements
    const changeElements = document.querySelectorAll(`[data-symbol="${symbol}"][data-field="change"]`)
    changeElements.forEach(el => {
      const changeClass = quote.change >= 0 ? 'positive' : 'negative'
      el.className = changeClass
      el.innerHTML = `
        ${quote.change >= 0 ? '+' : ''}$${Math.abs(quote.change).toFixed(2)}
        <br>
        <span class="text-sm">(${quote.changePercent})</span>
      `
    })
    
    // Update value calculations
    const quantityEl = document.querySelector(`[data-symbol="${symbol}"][data-field="quantity"]`)
    if (quantityEl) {
      const quantity = parseFloat(quantityEl.textContent)
      const valueEl = document.querySelector(`[data-symbol="${symbol}"][data-field="value"]`)
      if (valueEl) {
        valueEl.textContent = `$${(quantity * quote.price).toFixed(2)}`
      }
      
      // Update gain/loss
      const avgCostEl = document.querySelector(`[data-symbol="${symbol}"][data-field="avg-cost"]`)
      if (avgCostEl) {
        const avgCost = parseFloat(avgCostEl.textContent.replace('$', ''))
        const gainLoss = quantity * (quote.price - avgCost)
        const gainLossPercent = ((quote.price - avgCost) / avgCost * 100)
        
        const gainLossEl = document.querySelector(`[data-symbol="${symbol}"][data-field="gain-loss"]`)
        if (gainLossEl) {
          gainLossEl.className = gainLoss >= 0 ? 'positive' : 'negative'
          gainLossEl.innerHTML = `
            ${gainLoss >= 0 ? '+' : ''}$${Math.abs(gainLoss).toFixed(2)}
            <br>
            <span class="text-sm">(${gainLossPercent >= 0 ? '+' : ''}${gainLossPercent.toFixed(2)}%)</span>
          `
        }
      }
    }
    
    // Update last update display
    this.updateLastUpdateDisplay()
  }

  // Update connection status display
  updateConnectionStatus(status) {
    const indicator = document.getElementById('realtimeStatus')
    if (!indicator) return
    
    switch (status) {
      case 'connecting':
        indicator.className = 'realtime-indicator connecting'
        indicator.innerHTML = '<i class="fas fa-satellite-dish"></i> Connecting...'
        break
        
      case 'connected':
        indicator.className = 'realtime-indicator connected'
        indicator.innerHTML = '<i class="fas fa-satellite-dish"></i> LIVE'
        break
        
      case 'error':
        indicator.className = 'realtime-indicator error'
        indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Connection Error'
        break
        
      case 'disconnected':
        indicator.className = 'realtime-indicator disconnected'
        indicator.innerHTML = '<i class="fas fa-satellite-dish"></i> Disconnected'
        break
    }
  }

  // Update last update display
  updateLastUpdateDisplay() {
    if (!this.lastUpdate) return
    
    const elements = [
      document.getElementById('lastRealtimeUpdate'),
      document.getElementById('headerLastUpdate')
    ]
    
    elements.forEach(el => {
      if (el) {
        const secondsAgo = Math.floor((Date.now() - this.lastUpdate) / 1000)
        
        if (secondsAgo < 1) {
          el.innerHTML = '<i class="fas fa-bolt text-green-500"></i> Live'
        } else if (secondsAgo < 5) {
          el.innerHTML = '<i class="fas fa-check-circle text-green-500"></i> Just updated'
        } else if (secondsAgo < 60) {
          el.innerHTML = `<i class="fas fa-clock"></i> ${secondsAgo}s ago`
        } else {
          const minutesAgo = Math.floor(secondsAgo / 60)
          el.innerHTML = `<i class="fas fa-clock"></i> ${minutesAgo}m ago`
        }
      }
    })
  }

  // Register callback for quote updates
  onQuoteUpdate(callback) {
    this.updateCallbacks.push(callback)
  }

  // Get cached price for symbol
  getCachedPrice(symbol) {
    return this.priceCache.get(symbol)
  }

  // Disconnect from real-time feed
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
      this.connected = false
      this.updateConnectionStatus('disconnected')
    }
  }

  // Check if connected
  isConnected() {
    return this.connected
  }
}

// CSS for real-time effects
const realtimeStyles = `
<style>
.realtime-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
}

.realtime-indicator.connecting {
  background: #fef3c7;
  color: #92400e;
  animation: pulse 2s infinite;
}

.realtime-indicator.connected {
  background: #d1fae5;
  color: #065f46;
  animation: glow 2s ease-in-out infinite;
}

.realtime-indicator.error {
  background: #fee2e2;
  color: #991b1b;
}

.realtime-indicator.disconnected {
  background: #f3f4f6;
  color: #6b7280;
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(16, 185, 129, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.8);
  }
}

.price-flash-up {
  animation: flashGreen 0.5s ease;
  color: #10b981 !important;
  font-weight: bold;
}

.price-flash-down {
  animation: flashRed 0.5s ease;
  color: #ef4444 !important;
  font-weight: bold;
}

@keyframes flashGreen {
  0% {
    background-color: rgba(16, 185, 129, 0.3);
    transform: scale(1.05);
  }
  100% {
    background-color: transparent;
    transform: scale(1);
  }
}

@keyframes flashRed {
  0% {
    background-color: rgba(239, 68, 68, 0.3);
    transform: scale(1.05);
  }
  100% {
    background-color: transparent;
    transform: scale(1);
  }
}

.live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: livePulse 2s infinite;
  margin-left: 4px;
}

@keyframes livePulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.5;
  }
}
</style>
`

// Add styles to document
document.head.insertAdjacentHTML('beforeend', realtimeStyles)

// Export for use in main app
window.RealtimeMarketData = RealtimeMarketData