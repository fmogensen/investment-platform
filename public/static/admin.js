// Admin Panel for API Configuration Management

class AdminPanel {
  constructor() {
    this.password = null
    this.config = null
    this.init()
  }

  init() {
    this.render()
    this.promptPassword()
  }

  promptPassword() {
    const modal = `
      <div class="modal-overlay" id="passwordModal">
        <div class="modal-content">
          <h2 class="text-2xl font-bold mb-4">Admin Authentication</h2>
          <p class="text-gray-600 mb-4">Enter admin password to access API configuration</p>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Password</label>
              <input type="password" id="adminPassword" class="w-full px-3 py-2 border rounded-lg" 
                     placeholder="Enter admin password" autofocus>
            </div>
          </div>
          
          <div class="flex gap-2 mt-6">
            <button onclick="adminPanel.authenticate()" 
                    class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              <i class="fas fa-lock-open mr-2"></i>Login
            </button>
            <button onclick="window.location.href='/'" 
                    class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', modal)
    
    // Allow Enter key to submit
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.authenticate()
    })
  }

  async authenticate() {
    const password = document.getElementById('adminPassword').value
    if (!password) {
      this.showNotification('Please enter password', 'error')
      return
    }

    this.password = password
    
    try {
      await this.loadConfiguration()
      document.getElementById('passwordModal').remove()
      this.renderDashboard()
    } catch (error) {
      this.showNotification('Invalid password', 'error')
      this.password = null
    }
  }

  async loadConfiguration() {
    const response = await axios.get('/api/admin/config', {
      headers: { 'Authorization': `Bearer ${this.password}` }
    })
    this.config = response.data
  }

  async saveAPIKey(provider, apiKey) {
    try {
      const response = await axios.post('/api/admin/config', {
        provider,
        apiKey: apiKey || null
      }, {
        headers: { 'Authorization': `Bearer ${this.password}` }
      })
      
      if (response.data.success) {
        this.showNotification(`${provider} API key updated`, 'success')
        await this.loadConfiguration()
        this.renderDashboard()
      }
    } catch (error) {
      this.showNotification('Failed to save API key', 'error')
    }
  }

  async setDefaultProvider(provider) {
    try {
      const response = await axios.post('/api/admin/config', {
        provider,
        setDefault: true
      }, {
        headers: { 'Authorization': `Bearer ${this.password}` }
      })
      
      if (response.data.success) {
        this.showNotification(`${provider} set as default provider`, 'success')
        await this.loadConfiguration()
        this.renderDashboard()
      }
    } catch (error) {
      this.showNotification('Failed to set default provider', 'error')
    }
  }

  async testAPI(provider) {
    const button = document.getElementById(`test-${provider}`)
    const originalText = button.innerHTML
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...'
    button.disabled = true

    try {
      const response = await axios.post('/api/admin/test-api', {
        provider,
        symbol: 'AAPL'
      }, {
        headers: { 'Authorization': `Bearer ${this.password}` }
      })
      
      if (response.data.success) {
        this.showNotification(
          `${provider} API working! Response time: ${response.data.responseTime}ms`, 
          'success'
        )
        
        // Show test result
        const resultDiv = document.getElementById(`result-${provider}`)
        resultDiv.innerHTML = `
          <div class="mt-2 p-3 bg-green-50 border border-green-200 rounded">
            <p class="text-sm text-green-800">✅ API Test Successful</p>
            <p class="text-xs text-gray-600 mt-1">
              AAPL: $${response.data.data.price} | 
              Response: ${response.data.responseTime}ms
            </p>
          </div>
        `
      } else {
        throw new Error(response.data.error)
      }
    } catch (error) {
      this.showNotification(`${provider} API test failed: ${error.message}`, 'error')
      
      const resultDiv = document.getElementById(`result-${provider}`)
      resultDiv.innerHTML = `
        <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded">
          <p class="text-sm text-red-800">❌ API Test Failed</p>
          <p class="text-xs text-gray-600 mt-1">${error.message}</p>
        </div>
      `
    } finally {
      button.innerHTML = originalText
      button.disabled = false
    }
  }

  async updateSettings(settings) {
    try {
      const response = await axios.post('/api/admin/settings', settings, {
        headers: { 'Authorization': `Bearer ${this.password}` }
      })
      
      if (response.data.success) {
        this.showNotification('Settings updated successfully', 'success')
        await this.loadConfiguration()
      }
    } catch (error) {
      this.showNotification('Failed to update settings', 'error')
    }
  }

  renderDashboard() {
    const content = document.getElementById('content')
    if (!this.config) return

    const providers = this.config.providers || []
    const settings = this.config.settings || []
    const usage = this.config.usage || []

    content.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex justify-between items-center">
            <h1 class="text-3xl font-bold">
              <i class="fas fa-cog mr-2"></i>API Configuration Admin
            </h1>
            <button onclick="adminPanel.loadConfiguration().then(() => adminPanel.renderDashboard())" 
                    class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              <i class="fas fa-sync-alt mr-2"></i>Refresh
            </button>
          </div>
        </div>

        <!-- API Providers (WebSocket Only) -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-xl font-bold mb-4">WebSocket-Enabled API Providers</h2>
          <p class="text-sm text-gray-600 mb-4">Only real-time WebSocket APIs are supported for near real-time market data.</p>
          <div class="space-y-4">
            ${providers.filter(p => ['finnhub', 'twelve_data'].includes(p.name)).map(provider => `
              <div class="border rounded-lg p-4 ${provider.is_default ? 'border-blue-500 bg-blue-50' : ''}">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <h3 class="font-bold text-lg">
                      ${provider.display_name || provider.name}
                      <span class="ml-2 text-sm bg-purple-600 text-white px-2 py-1 rounded">WEBSOCKET</span>
                      ${provider.is_default ? '<span class="ml-2 text-sm bg-blue-600 text-white px-2 py-1 rounded">DEFAULT</span>' : ''}
                      ${provider.has_key ? '<span class="ml-2 text-sm bg-green-600 text-white px-2 py-1 rounded">CONFIGURED</span>' : '<span class="ml-2 text-sm bg-red-600 text-white px-2 py-1 rounded">NO KEY</span>'}
                    </h3>
                    <p class="text-sm text-gray-600 mt-1">
                      Rate Limit: ${provider.rate_limit || 'N/A'}/min | 
                      Daily Limit: ${provider.daily_limit || 'N/A'}/day
                      ${provider.last_used ? ` | Last Used: ${new Date(provider.last_used).toLocaleString()}` : ''}
                    </p>
                    
                    <div class="mt-3 flex items-center gap-2">
                      <input type="password" 
                             id="apikey-${provider.name}" 
                             class="flex-1 px-3 py-2 border rounded-lg text-sm"
                             placeholder="${provider.has_key ? 'Enter new API key (leave blank to keep current)' : 'Enter API key'}">
                      <button onclick="adminPanel.saveAPIKey('${provider.name}', document.getElementById('apikey-${provider.name}').value)"
                              class="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm">
                        <i class="fas fa-save mr-1"></i>Save
                      </button>
                      ${!provider.is_default ? `
                        <button onclick="adminPanel.setDefaultProvider('${provider.name}')"
                                class="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm">
                          <i class="fas fa-star mr-1"></i>Set Default
                        </button>
                      ` : ''}
                      <button id="test-${provider.name}"
                              onclick="adminPanel.testAPI('${provider.name}')"
                              class="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-sm">
                        <i class="fas fa-vial mr-1"></i>Test
                      </button>
                    </div>
                    
                    <div id="result-${provider.name}"></div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Settings -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-xl font-bold mb-4">General Settings</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${settings.map(setting => `
              <div class="border rounded-lg p-3">
                <label class="block text-sm font-medium mb-1">${setting.description || setting.setting_key}</label>
                ${setting.setting_type === 'boolean' ? `
                  <select id="setting-${setting.setting_key}" 
                          class="w-full px-3 py-2 border rounded-lg"
                          onchange="adminPanel.updateSettings({'${setting.setting_key}': this.value})">
                    <option value="true" ${setting.setting_value === 'true' ? 'selected' : ''}>Enabled</option>
                    <option value="false" ${setting.setting_value === 'false' ? 'selected' : ''}>Disabled</option>
                  </select>
                ` : `
                  <input type="${setting.setting_type === 'number' ? 'number' : 'text'}"
                         id="setting-${setting.setting_key}"
                         value="${setting.setting_value}"
                         class="w-full px-3 py-2 border rounded-lg"
                         onblur="adminPanel.updateSettings({'${setting.setting_key}': this.value})">
                `}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Usage Statistics -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-xl font-bold mb-4">API Usage (Last 24 Hours)</h2>
          ${usage.length > 0 ? `
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b">
                    <th class="text-left py-2">Provider</th>
                    <th class="text-right py-2">Total Requests</th>
                    <th class="text-right py-2">Avg Response Time</th>
                    <th class="text-right py-2">Errors</th>
                    <th class="text-right py-2">Last Request</th>
                  </tr>
                </thead>
                <tbody>
                  ${usage.map(u => `
                    <tr class="border-b hover:bg-gray-50">
                      <td class="py-3">${u.provider}</td>
                      <td class="py-3 text-right">${u.total_requests || 0}</td>
                      <td class="py-3 text-right">${u.avg_response_time ? Math.round(u.avg_response_time) + 'ms' : 'N/A'}</td>
                      <td class="py-3 text-right ${u.error_count > 0 ? 'text-red-600' : ''}">${u.error_count || 0}</td>
                      <td class="py-3 text-right">${u.last_request ? new Date(u.last_request).toLocaleTimeString() : 'Never'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <p class="text-gray-500 text-center py-4">No API usage data available</p>
          `}
        </div>

        <!-- Instructions -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 class="font-bold text-lg mb-2">
            <i class="fas fa-info-circle mr-2"></i>Important Information
          </h3>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>Only WebSocket-enabled APIs (Finnhub & Twelve Data) are supported</li>
            <li>Real-time data streams directly to your browser via WebSockets</li>
            <li>Automatic reconnection if connection is lost</li>
            <li>Test each API after adding/updating keys to ensure they work</li>
            <li>Rate limits are enforced to prevent API quota exhaustion</li>
            <li>Near real-time updates every 2-3 seconds</li>
          </ul>
        </div>
      </div>
    `
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 fade-in ${
      type === 'success' ? 'bg-green-600' : 
      type === 'error' ? 'bg-red-600' : 
      'bg-blue-600'
    }`
    notification.innerHTML = `
      <div class="flex items-center">
        <i class="fas ${
          type === 'success' ? 'fa-check-circle' : 
          type === 'error' ? 'fa-exclamation-circle' : 
          'fa-info-circle'
        } mr-2"></i>
        ${message}
      </div>
    `
    
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 3000)
  }

  render() {
    const app = document.getElementById('adminApp')
    
    app.innerHTML = `
      <!-- Header -->
      <header class="bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-lg">
        <div class="container mx-auto px-4 py-4">
          <div class="flex justify-between items-center">
            <h1 class="text-2xl font-bold">
              <i class="fas fa-shield-alt mr-2"></i>Admin Panel
            </h1>
            <a href="/" class="text-white hover:text-gray-300">
              <i class="fas fa-arrow-left mr-2"></i>Back to Platform
            </a>
          </div>
        </div>
      </header>
      
      <!-- Main Content -->
      <main class="container mx-auto px-4 py-8">
        <div id="content" class="fade-in">
          <!-- Content will be loaded here -->
        </div>
      </main>
      
      <!-- Footer -->
      <footer class="bg-gray-800 text-white py-4 mt-12">
        <div class="container mx-auto px-4 text-center">
          <p class="text-sm">Admin Panel - API Configuration Management</p>
          <p class="text-xs text-gray-400 mt-1">
            <i class="fas fa-lock mr-1"></i>
            Secure configuration for multiple stock market data providers
          </p>
        </div>
      </footer>
    `
  }
}

// Initialize admin panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.adminPanel = new AdminPanel()
})