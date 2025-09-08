// Investment Platform Frontend Application

class InvestmentApp {
  constructor() {
    // Get portfolio ID from localStorage or use default
    this.portfolioId = localStorage.getItem('selectedPortfolioId') || '1';
    this.currentView = 'portfolio';
    this.portfolio = null;
    this.watchlist = [];
    this.searchResults = [];
    this.selectedStock = null;
    this.priceUpdateInterval = null;
    this.charts = {};
    this.lastUpdateTime = null;
    this.updateInProgress = false;
    this.realtimeData = null;
    
    this.init();
  }

  init() {
    this.render();
    this.loadPortfolio();
    this.initializeRealtime();
    this.setupEventListeners();
    this.setupPortfolioChangeListener();
  }

  setupPortfolioChangeListener() {
    // Listen for portfolio changes from the portfolio manager
    window.addEventListener('portfolioChanged', (event) => {
      this.portfolioId = event.detail.portfolioId;
      // Portfolio manager will handle reloading
    });
  }

  initializeRealtime() {
    // Initialize real-time market data connection
    this.realtimeData = new RealtimeMarketData();
    
    // Register callback for real-time updates
    this.realtimeData.onQuoteUpdate((symbol, quote) => {
      this.handleRealtimeQuote(symbol, quote);
    });
    
    // Connect to real-time feed
    this.realtimeData.connect();
    
    // Update display every second
    setInterval(() => {
      this.realtimeData.updateLastUpdateDisplay();
    }, 1000);
  }

  handleRealtimeQuote(symbol, quote) {
    // Update portfolio if we have holdings for this symbol
    if (this.portfolio?.holdings) {
      const holding = this.portfolio.holdings.find(h => h.symbol === symbol);
      if (holding) {
        // Update holding with real-time price
        holding.last_price = quote.price;
        holding.current_value = holding.quantity * quote.price;
        holding.gain_loss = holding.current_value - (holding.quantity * holding.average_cost);
        holding.gain_loss_percent = (holding.gain_loss / (holding.quantity * holding.average_cost)) * 100;
        
        // Recalculate portfolio totals
        this.recalculatePortfolioTotals();
      }
    }
  }

  recalculatePortfolioTotals() {
    if (!this.portfolio?.holdings) return;
    
    const totals = this.portfolio.holdings.reduce((acc, holding) => {
      acc.value += holding.current_value || 0;
      acc.cost += (holding.quantity * holding.average_cost) || 0;
      return acc;
    }, { value: 0, cost: 0 });
    
    this.portfolio.summary.totalValue = totals.value;
    this.portfolio.summary.totalCost = totals.cost;
    this.portfolio.summary.totalGainLoss = totals.value - totals.cost;
    this.portfolio.summary.totalGainLossPercent = totals.cost ? 
      ((totals.value - totals.cost) / totals.cost * 100) : 0;
    
    // Update header value
    const headerValue = document.getElementById('headerValue');
    if (headerValue) {
      headerValue.textContent = totals.value.toFixed(2);
    }
  }

  setupEventListeners() {
    // Navigation
    document.addEventListener('click', (e) => {
      if (e.target.dataset.view) {
        this.switchView(e.target.dataset.view);
      }
      
      if (e.target.dataset.action) {
        this.handleAction(e.target.dataset.action, e.target.dataset);
      }
    });

    // Search functionality
    document.addEventListener('input', (e) => {
      if (e.target.id === 'stockSearch') {
        this.debounce(() => this.searchStocks(e.target.value), 500)();
      }
    });

    // Portfolio selector
    document.addEventListener('change', (e) => {
      if (e.target.id === 'portfolioSelector') {
        const newPortfolioId = e.target.value;
        if (newPortfolioId && newPortfolioId !== this.portfolioId) {
          portfolioManager.switchPortfolio(newPortfolioId);
        }
      }
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  async loadPortfolio() {
    try {
      const response = await axios.get(`/api/portfolio/${this.portfolioId}`);
      this.portfolio = response.data;
      this.updatePortfolioView();
    } catch (error) {
      console.error('Failed to load portfolio:', error);
      this.showNotification('Failed to load portfolio', 'error');
    }
  }

  async loadWatchlist() {
    try {
      const response = await axios.get('/api/watchlist');
      this.watchlist = response.data.watchlist;
      this.updateWatchlistView();
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    }
  }

  async searchStocks(query) {
    if (!query || query.length < 2) {
      this.searchResults = [];
      this.updateSearchResults();
      return;
    }

    try {
      const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
      this.searchResults = response.data.results;
      this.updateSearchResults();
    } catch (error) {
      console.error('Search failed:', error);
    }
  }

  async getQuote(symbol) {
    try {
      const response = await axios.get(`/api/quote/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get quote:', error);
      return null;
    }
  }

  async buyStock(symbol, quantity, price) {
    try {
      const response = await axios.post(`/api/portfolio/${this.portfolioId}/buy`, {
        symbol,
        quantity: parseFloat(quantity),
        price: parseFloat(price)
      });
      
      if (response.data.success) {
        this.showNotification('Purchase successful!', 'success');
        this.loadPortfolio();
        this.closeModal();
      }
    } catch (error) {
      console.error('Buy failed:', error);
      this.showNotification('Purchase failed', 'error');
    }
  }

  async sellStock(symbol, quantity, price) {
    try {
      const response = await axios.post(`/api/portfolio/${this.portfolioId}/sell`, {
        symbol,
        quantity: parseFloat(quantity),
        price: parseFloat(price)
      });
      
      if (response.data.success) {
        this.showNotification(`Sale successful! Profit: $${response.data.profit.toFixed(2)}`, 'success');
        this.loadPortfolio();
        this.closeModal();
      }
    } catch (error) {
      console.error('Sell failed:', error);
      this.showNotification(error.response?.data?.error || 'Sale failed', 'error');
    }
  }

  async addToWatchlist(symbol, targetPrice, notes) {
    try {
      const response = await axios.post('/api/watchlist', {
        symbol,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        notes
      });
      
      if (response.data.success) {
        this.showNotification('Added to watchlist!', 'success');
        this.loadWatchlist();
      }
    } catch (error) {
      console.error('Failed to add to watchlist:', error);
      this.showNotification('Failed to add to watchlist', 'error');
    }
  }

  async updatePrices() {
    if (this.updateInProgress) return; // Prevent concurrent updates
    
    this.updateInProgress = true;
    this.updateStatusIndicator('updating');
    
    try {
      const response = await axios.post('/api/update-prices');
      if (response.data.success) {
        this.lastUpdateTime = new Date();
        this.updateLastUpdateDisplay();
        await this.loadPortfolio();
        this.updateStatusIndicator('success');
      } else {
        this.updateStatusIndicator('error');
      }
    } catch (error) {
      console.error('Failed to update prices:', error);
      this.updateStatusIndicator('error');
    } finally {
      this.updateInProgress = false;
    }
  }

  updateStatusIndicator(status) {
    // Update portfolio view indicator
    const indicator = document.getElementById('updateStatus');
    if (indicator) {
      switch(status) {
        case 'updating':
          indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin text-blue-600"></i> Updating prices...';
          break;
        case 'success':
          indicator.innerHTML = '<i class="fas fa-check-circle text-green-600"></i> Updated';
          setTimeout(() => {
            if (indicator) indicator.innerHTML = '';
          }, 3000);
          break;
        case 'error':
          indicator.innerHTML = '<i class="fas fa-exclamation-circle text-red-600"></i> Update failed';
          setTimeout(() => {
            if (indicator) indicator.innerHTML = '';
          }, 5000);
          break;
      }
    }
    
    // Update header indicator
    const headerIndicator = document.getElementById('headerUpdateIndicator');
    if (headerIndicator) {
      headerIndicator.className = 'update-indicator';
      switch(status) {
        case 'updating':
          headerIndicator.classList.add('updating');
          headerIndicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i><span>Updating...</span>';
          break;
        case 'success':
          headerIndicator.classList.add('success');
          headerIndicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Updated</span>';
          setTimeout(() => {
            if (headerIndicator) {
              headerIndicator.className = 'update-indicator';
              headerIndicator.innerHTML = '<i class="fas fa-sync-alt"></i><span>Auto-update ON</span>';
            }
          }, 3000);
          break;
        case 'error':
          headerIndicator.classList.add('error');
          headerIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Update failed</span>';
          setTimeout(() => {
            if (headerIndicator) {
              headerIndicator.className = 'update-indicator';
              headerIndicator.innerHTML = '<i class="fas fa-sync-alt"></i><span>Auto-update ON</span>';
            }
          }, 5000);
          break;
      }
    }
  }

  updateLastUpdateDisplay() {
    // Update portfolio view
    const element = document.getElementById('lastUpdate');
    if (element && this.lastUpdateTime) {
      const timeStr = this.lastUpdateTime.toLocaleTimeString();
      const secondsAgo = Math.floor((Date.now() - this.lastUpdateTime) / 1000);
      
      if (secondsAgo < 60) {
        element.innerHTML = `<i class="fas fa-clock text-gray-500"></i> Last updated: just now`;
      } else {
        const minutesAgo = Math.floor(secondsAgo / 60);
        element.innerHTML = `<i class="fas fa-clock text-gray-500"></i> Last updated: ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
      }
    }
    
    // Update header
    const headerElement = document.getElementById('headerLastUpdate');
    if (headerElement && this.lastUpdateTime) {
      const timeStr = this.lastUpdateTime.toLocaleTimeString();
      const secondsAgo = Math.floor((Date.now() - this.lastUpdateTime) / 1000);
      
      if (secondsAgo < 60) {
        headerElement.innerHTML = `<i class="fas fa-check-circle"></i> Updated ${timeStr}`;
      } else {
        const minutesAgo = Math.floor(secondsAgo / 60);
        headerElement.innerHTML = `<i class="fas fa-clock"></i> Updated ${minutesAgo}m ago`;
      }
      
      // Add visual warning if data is stale (> 5 minutes)
      if (secondsAgo > 300) {
        headerElement.classList.add('pulse-animation');
      } else {
        headerElement.classList.remove('pulse-animation');
      }
    }
  }

  startPriceUpdates() {
    // Real-time updates are handled by RealtimeMarketData
    // This is now a fallback for manual refresh if needed
    console.log('Real-time updates active via SSE/WebSocket');
  }

  stopPriceUpdates() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }
  }

  switchView(view) {
    this.currentView = view;
    this.render();
    
    // Load data for the view
    switch(view) {
      case 'portfolio':
        this.loadPortfolio();
        break;
      case 'watchlist':
        this.loadWatchlist();
        break;
      case 'search':
        document.getElementById('stockSearch')?.focus();
        break;
    }
  }

  handleAction(action, data) {
    switch(action) {
      case 'showBuyModal':
        this.showBuyModal(data.symbol);
        break;
      case 'showSellModal':
        this.showSellModal(data.symbol);
        break;
      case 'showQuote':
        this.showQuoteModal(data.symbol);
        break;
      case 'addToWatchlist':
        this.showWatchlistModal(data.symbol);
        break;

    }
  }

  async showBuyModal(symbol) {
    const quote = await this.getQuote(symbol);
    if (!quote) return;

    const modal = `
      <div class="modal-overlay" id="modal">
        <div class="modal-content">
          <h2 class="text-2xl font-bold mb-4">Buy ${symbol}</h2>
          <p class="text-gray-600 mb-4">Current Price: $${quote.price?.toFixed(2) || 'N/A'}</p>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Quantity</label>
              <input type="number" id="buyQuantity" class="w-full px-3 py-2 border rounded-lg" 
                     placeholder="Number of shares" min="1" step="1">
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-1">Price per Share</label>
              <input type="number" id="buyPrice" class="w-full px-3 py-2 border rounded-lg" 
                     value="${quote.price?.toFixed(2) || ''}" step="0.01">
            </div>
            
            <div class="bg-gray-100 p-3 rounded">
              <p class="text-sm">Total Cost: $<span id="totalCost">0.00</span></p>
            </div>
          </div>
          
          <div class="flex gap-2 mt-6">
            <button onclick="app.executeBuy('${symbol}')" 
                    class="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              <i class="fas fa-check mr-2"></i>Confirm Purchase
            </button>
            <button onclick="app.closeModal()" 
                    class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
    
    // Calculate total cost
    const quantityInput = document.getElementById('buyQuantity');
    const priceInput = document.getElementById('buyPrice');
    const updateTotal = () => {
      const total = (parseFloat(quantityInput.value) || 0) * (parseFloat(priceInput.value) || 0);
      document.getElementById('totalCost').textContent = total.toFixed(2);
    };
    
    quantityInput.addEventListener('input', updateTotal);
    priceInput.addEventListener('input', updateTotal);
  }

  async showSellModal(symbol) {
    // Find holding
    const holding = this.portfolio?.holdings?.find(h => h.symbol === symbol);
    if (!holding) {
      this.showNotification('You do not own this stock', 'error');
      return;
    }

    const quote = await this.getQuote(symbol);
    
    const modal = `
      <div class="modal-overlay" id="modal">
        <div class="modal-content">
          <h2 class="text-2xl font-bold mb-4">Sell ${symbol}</h2>
          <p class="text-gray-600 mb-2">You own: ${holding.quantity} shares</p>
          <p class="text-gray-600 mb-4">Current Price: $${quote?.price?.toFixed(2) || 'N/A'}</p>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Quantity to Sell</label>
              <input type="number" id="sellQuantity" class="w-full px-3 py-2 border rounded-lg" 
                     placeholder="Number of shares" min="1" max="${holding.quantity}" step="1">
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-1">Price per Share</label>
              <input type="number" id="sellPrice" class="w-full px-3 py-2 border rounded-lg" 
                     value="${quote?.price?.toFixed(2) || ''}" step="0.01">
            </div>
            
            <div class="bg-gray-100 p-3 rounded">
              <p class="text-sm">Total Proceeds: $<span id="totalProceeds">0.00</span></p>
              <p class="text-sm">Cost Basis: $${holding.average_cost.toFixed(2)} per share</p>
              <p class="text-sm">Estimated Profit/Loss: $<span id="profitLoss">0.00</span></p>
            </div>
          </div>
          
          <div class="flex gap-2 mt-6">
            <button onclick="app.executeSell('${symbol}')" 
                    class="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
              <i class="fas fa-check mr-2"></i>Confirm Sale
            </button>
            <button onclick="app.closeModal()" 
                    class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
    
    // Calculate totals
    const quantityInput = document.getElementById('sellQuantity');
    const priceInput = document.getElementById('sellPrice');
    const updateTotal = () => {
      const quantity = parseFloat(quantityInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;
      const proceeds = quantity * price;
      const profit = quantity * (price - holding.average_cost);
      
      document.getElementById('totalProceeds').textContent = proceeds.toFixed(2);
      document.getElementById('profitLoss').textContent = profit.toFixed(2);
      document.getElementById('profitLoss').className = profit >= 0 ? 'positive' : 'negative';
    };
    
    quantityInput.addEventListener('input', updateTotal);
    priceInput.addEventListener('input', updateTotal);
  }

  async showQuoteModal(symbol) {
    const quote = await this.getQuote(symbol);
    if (!quote) {
      this.showNotification('Failed to get quote', 'error');
      return;
    }

    const modal = `
      <div class="modal-overlay" id="modal">
        <div class="modal-content">
          <h2 class="text-2xl font-bold mb-4">${symbol} - Quote</h2>
          
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-gray-600">Price:</span>
              <span class="font-semibold">$${quote.price?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Change:</span>
              <span class="${quote.change >= 0 ? 'positive' : 'negative'} font-semibold">
                ${quote.change >= 0 ? '+' : ''}${quote.change?.toFixed(2) || '0'} 
                (${quote.changePercent || '0%'})
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Open:</span>
              <span>$${quote.open?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">High:</span>
              <span>$${quote.high?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Low:</span>
              <span>$${quote.low?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Previous Close:</span>
              <span>$${quote.previousClose?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Volume:</span>
              <span>${quote.volume?.toLocaleString() || 'N/A'}</span>
            </div>
          </div>
          
          <div class="flex gap-2 mt-6">
            <button onclick="app.showBuyModal('${symbol}')"
                    class="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              <i class="fas fa-shopping-cart mr-2"></i>Buy
            </button>
            <button onclick="app.showWatchlistModal('${symbol}')"
                    class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              <i class="fas fa-star mr-2"></i>Watch
            </button>
            <button onclick="app.closeModal()" 
                    class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
  }

  showWatchlistModal(symbol) {
    const modal = `
      <div class="modal-overlay" id="modal">
        <div class="modal-content">
          <h2 class="text-2xl font-bold mb-4">Add ${symbol} to Watchlist</h2>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Target Price (Optional)</label>
              <input type="number" id="targetPrice" class="w-full px-3 py-2 border rounded-lg" 
                     placeholder="Alert when price reaches..." step="0.01">
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-1">Notes (Optional)</label>
              <textarea id="watchlistNotes" class="w-full px-3 py-2 border rounded-lg" 
                        rows="3" placeholder="Why are you watching this stock?"></textarea>
            </div>
          </div>
          
          <div class="flex gap-2 mt-6">
            <button onclick="app.executeAddToWatchlist('${symbol}')" 
                    class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              <i class="fas fa-star mr-2"></i>Add to Watchlist
            </button>
            <button onclick="app.closeModal()" 
                    class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
  }

  executeBuy(symbol) {
    const quantity = document.getElementById('buyQuantity').value;
    const price = document.getElementById('buyPrice').value;
    
    if (!quantity || !price) {
      this.showNotification('Please enter quantity and price', 'error');
      return;
    }
    
    this.buyStock(symbol, quantity, price);
  }

  executeSell(symbol) {
    const quantity = document.getElementById('sellQuantity').value;
    const price = document.getElementById('sellPrice').value;
    
    if (!quantity || !price) {
      this.showNotification('Please enter quantity and price', 'error');
      return;
    }
    
    this.sellStock(symbol, quantity, price);
  }

  executeAddToWatchlist(symbol) {
    const targetPrice = document.getElementById('targetPrice').value;
    const notes = document.getElementById('watchlistNotes').value;
    
    this.addToWatchlist(symbol, targetPrice, notes);
    this.closeModal();
  }

  closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
      modal.remove();
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 fade-in ${
      type === 'success' ? 'bg-green-600' : 
      type === 'error' ? 'bg-red-600' : 
      'bg-blue-600'
    }`;
    notification.innerHTML = `
      <div class="flex items-center">
        <i class="fas ${
          type === 'success' ? 'fa-check-circle' : 
          type === 'error' ? 'fa-exclamation-circle' : 
          'fa-info-circle'
        } mr-2"></i>
        ${message}
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  updatePortfolioView() {
    if (this.currentView !== 'portfolio') return;
    
    const content = document.getElementById('content');
    if (!this.portfolio) {
      content.innerHTML = '<div class="text-center py-8">Loading portfolio...</div>';
      return;
    }
    
    const { portfolio, holdings, summary } = this.portfolio;
    
    content.innerHTML = `
      <div class="space-y-6">
        <!-- Portfolio Summary -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-2xl font-bold mb-4">${portfolio.name}</h2>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p class="text-gray-600 text-sm">Total Value</p>
              <p class="portfolio-value">$${summary.totalValue.toFixed(2)}</p>
            </div>
            <div>
              <p class="text-gray-600 text-sm">Total Cost</p>
              <p class="text-xl font-semibold">$${summary.totalCost.toFixed(2)}</p>
            </div>
            <div>
              <p class="text-gray-600 text-sm">Total Gain/Loss</p>
              <p class="text-xl font-semibold ${summary.totalGainLoss >= 0 ? 'positive' : 'negative'}">
                ${summary.totalGainLoss >= 0 ? '+' : ''}$${Math.abs(summary.totalGainLoss).toFixed(2)}
              </p>
            </div>
            <div>
              <p class="text-gray-600 text-sm">Return %</p>
              <p class="text-xl font-semibold ${summary.totalGainLossPercent >= 0 ? 'positive' : 'negative'}">
                ${summary.totalGainLossPercent >= 0 ? '+' : ''}${summary.totalGainLossPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
        
        <!-- Holdings -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="text-xl font-bold">Holdings</h3>
              <div class="flex items-center gap-4 mt-1">
                <span id="lastUpdate" class="text-sm text-gray-600"></span>
                <span id="updateStatus" class="text-sm"></span>
              </div>
            </div>
          </div>
          
          ${holdings && holdings.length > 0 ? `
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b">
                    <th class="text-left py-2">Symbol</th>
                    <th class="text-left py-2">Name</th>
                    <th class="text-right py-2">Quantity</th>
                    <th class="text-right py-2">Avg Cost</th>
                    <th class="text-right py-2">Current Price</th>
                    <th class="text-right py-2">Value</th>
                    <th class="text-right py-2">Gain/Loss</th>
                    <th class="text-right py-2">Gain/Loss %</th>
                    <th class="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${holdings.map(h => `
                    <tr class="border-b hover:bg-gray-50">
                      <td class="py-3 font-semibold">${h.symbol}</td>
                      <td class="py-3">${h.name}</td>
                      <td class="py-3 text-right" data-symbol="${h.symbol}" data-field="quantity">${h.quantity}</td>
                      <td class="py-3 text-right" data-symbol="${h.symbol}" data-field="avg-cost">$${h.average_cost.toFixed(2)}</td>
                      <td class="py-3 text-right" data-symbol="${h.symbol}" data-field="price">$${h.last_price.toFixed(2)}</td>
                      <td class="py-3 text-right font-semibold" data-symbol="${h.symbol}" data-field="value">$${h.current_value.toFixed(2)}</td>
                      <td class="py-3 text-right ${h.gain_loss >= 0 ? 'positive' : 'negative'}" data-symbol="${h.symbol}" data-field="gain-loss">
                        ${h.gain_loss >= 0 ? '+' : ''}$${Math.abs(h.gain_loss).toFixed(2)}
                      </td>
                      <td class="py-3 text-right ${h.gain_loss_percent >= 0 ? 'positive' : 'negative'}" data-symbol="${h.symbol}" data-field="gain-loss-percent">
                        ${h.gain_loss_percent >= 0 ? '+' : ''}${h.gain_loss_percent.toFixed(2)}%
                      </td>
                      <td class="py-3 text-right">
                        <button onclick="app.showBuyModal('${h.symbol}')" 
                                class="text-green-600 hover:text-green-800 mr-2"
                                title="Buy more ${h.symbol}">
                          <i class="fas fa-plus"></i>
                        </button>
                        <button onclick="app.showSellModal('${h.symbol}')"
                                class="text-red-600 hover:text-red-800"
                                title="Sell ${h.symbol}">
                          <i class="fas fa-minus"></i>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <p class="text-gray-500 text-center py-8">No holdings yet. Start by searching and buying stocks!</p>
          `}
        </div>
        
        <!-- Portfolio Chart -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h3 class="text-xl font-bold mb-4">Portfolio Allocation</h3>
          <div class="chart-container">
            <canvas id="portfolioChart"></canvas>
          </div>
        </div>
      </div>
    `;
    
    // Create portfolio allocation chart
    if (holdings && holdings.length > 0) {
      this.createPortfolioChart(holdings);
    }
  }

  createPortfolioChart(holdings) {
    const ctx = document.getElementById('portfolioChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (this.charts.portfolio) {
      this.charts.portfolio.destroy();
    }
    
    this.charts.portfolio = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: holdings.map(h => h.symbol),
        datasets: [{
          data: holdings.map(h => h.current_value),
          backgroundColor: [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  updateWatchlistView() {
    if (this.currentView !== 'watchlist') return;
    
    const content = document.getElementById('content');
    
    content.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold mb-4">Watchlist</h2>
        
        ${this.watchlist && this.watchlist.length > 0 ? `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${this.watchlist.map(item => `
              <div class="stock-card p-4 rounded-lg hover:shadow-lg">
                <div class="flex justify-between items-start mb-2">
                  <h3 class="font-bold text-lg">${item.symbol}</h3>
                  <span class="text-2xl font-bold">$${item.last_price?.toFixed(2) || 'N/A'}</span>
                </div>
                <p class="text-gray-600 text-sm mb-2">${item.name}</p>
                ${item.target_price ? `
                  <p class="text-sm">
                    Target: $${item.target_price.toFixed(2)}
                    <span class="${item.last_price <= item.target_price ? 'positive' : 'negative'}">
                      (${((item.target_price - item.last_price) / item.last_price * 100).toFixed(1)}%)
                    </span>
                  </p>
                ` : ''}
                ${item.notes ? `<p class="text-sm text-gray-500 mt-2">${item.notes}</p>` : ''}
                <div class="mt-3 flex gap-2">
                  <button data-action="showQuote" data-symbol="${item.symbol}"
                          class="flex-1 bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200">
                    Quote
                  </button>
                  <button data-action="showBuyModal" data-symbol="${item.symbol}"
                          class="flex-1 bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">
                    Buy
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <p class="text-gray-500 text-center py-8">Your watchlist is empty. Search for stocks to add!</p>
        `}
      </div>
    `;
  }

  updateSearchResults() {
    const resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) return;
    
    if (this.searchResults.length === 0) {
      resultsDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No results found</p>';
      return;
    }
    
    resultsDiv.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${this.searchResults.map(stock => `
          <div class="stock-card p-4 rounded-lg hover:shadow-lg cursor-pointer">
            <h3 class="font-bold text-lg">${stock.symbol}</h3>
            <p class="text-gray-600 text-sm">${stock.name}</p>
            <p class="text-gray-500 text-xs mt-1">${stock.type || 'Stock'} - ${stock.region || stock.exchange || ''}</p>
            <div class="mt-3 flex gap-2">
              <button onclick="app.showQuoteModal('${stock.symbol}')"
                      class="flex-1 bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200">
                <i class="fas fa-chart-line mr-1"></i>Quote
              </button>
              <button onclick="app.showBuyModal('${stock.symbol}')"
                      class="flex-1 bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">
                <i class="fas fa-shopping-cart mr-1"></i>Buy
              </button>
              <button onclick="app.showWatchlistModal('${stock.symbol}')"
                      class="flex-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-200">
                <i class="fas fa-star mr-1"></i>Watch
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  render() {
    const app = document.getElementById('app');
    
    app.innerHTML = `
      <!-- Header -->
      <header class="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
        <div class="container mx-auto px-4 py-4">
          <div class="flex justify-between items-center">
            <h1 class="text-2xl font-bold">
              <i class="fas fa-chart-line mr-2"></i>Investment Platform
            </h1>
            <div class="flex items-center gap-4">
              <!-- Portfolio Selector -->
              <div class="flex items-center gap-2">
                <select id="portfolioSelector" 
                        class="bg-white/20 text-white border border-white/30 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-white/50">
                  <!-- Options will be populated by PortfolioManager -->
                </select>
                <button onclick="portfolioManager.showPortfolioList()"
                        class="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-sm transition">
                  <i class="fas fa-cog"></i> Manage
                </button>
              </div>
              <div class="text-sm">
                <div>Value: $<span id="headerValue">-</span></div>
                <div class="text-xs opacity-90" id="headerLastUpdate">
                  <i class="fas fa-clock"></i> Connecting...
                </div>
              </div>
              <div id="realtimeStatus" class="realtime-indicator connecting">
                <i class="fas fa-satellite-dish"></i> Connecting...
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <!-- Navigation -->
      <nav class="bg-white shadow-md sticky top-0 z-40">
        <div class="container mx-auto px-4">
          <div class="flex space-x-8">
            <button data-view="portfolio" 
                    class="py-3 px-4 hover:text-blue-600 ${this.currentView === 'portfolio' ? 'tab-active' : ''}">
              <i class="fas fa-briefcase mr-2"></i>Portfolio
            </button>
            <button data-view="search" 
                    class="py-3 px-4 hover:text-blue-600 ${this.currentView === 'search' ? 'tab-active' : ''}">
              <i class="fas fa-search mr-2"></i>Search
            </button>
            <button data-view="watchlist" 
                    class="py-3 px-4 hover:text-blue-600 ${this.currentView === 'watchlist' ? 'tab-active' : ''}">
              <i class="fas fa-star mr-2"></i>Watchlist
            </button>
            <button data-view="transactions" 
                    class="py-3 px-4 hover:text-blue-600 ${this.currentView === 'transactions' ? 'tab-active' : ''}">
              <i class="fas fa-history mr-2"></i>Transactions
            </button>
          </div>
        </div>
      </nav>
      
      <!-- Main Content -->
      <main class="container mx-auto px-4 py-8">
        ${this.currentView === 'search' ? `
          <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 class="text-2xl font-bold mb-4">Search Stocks & ETFs</h2>
            <div class="relative">
              <input type="text" id="stockSearch" 
                     class="w-full px-4 py-3 pr-10 border rounded-lg focus:outline-none focus:border-blue-500"
                     placeholder="Enter stock symbol or company name...">
              <i class="fas fa-search absolute right-3 top-4 text-gray-400"></i>
            </div>
          </div>
          <div id="searchResults"></div>
        ` : ''}
        
        <div id="content" class="fade-in">
          <!-- Dynamic content will be loaded here -->
        </div>
      </main>
      
      <!-- Footer -->
      <footer class="bg-gray-800 text-white py-4 mt-12">
        <div class="container mx-auto px-4 text-center">
          <p class="text-sm">Investment Platform © 2024 | Real-time market data</p>
          <p class="text-xs text-gray-400 mt-1">
            <i class="fas fa-sync-alt mr-1"></i>
            Automatic price updates every 60 seconds
          </p>
        </div>
      </footer>
    `;
    
    // Update header value
    if (this.portfolio?.summary) {
      document.getElementById('headerValue').textContent = this.portfolio.summary.totalValue.toFixed(2);
    }
    
    // Update last update display immediately
    this.updateLastUpdateDisplay();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new InvestmentApp();
});