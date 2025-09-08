// Portfolio Manager - Handles portfolio CRUD operations and UI
class PortfolioManager {
  constructor() {
    this.portfolios = [];
    this.currentPortfolioId = localStorage.getItem('selectedPortfolioId') || '1';
    this.modalElement = null;
    this.init();
  }

  async init() {
    await this.loadPortfolios();
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    // Create modal HTML for portfolio management
    const modalHTML = `
      <div id="portfolioModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div class="mt-3">
            <h3 class="text-lg font-medium text-gray-900 mb-4" id="modalTitle">Manage Portfolio</h3>
            <form id="portfolioForm">
              <input type="hidden" id="portfolioId" value="">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Portfolio Name</label>
                <input type="text" id="portfolioName" required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Growth Portfolio">
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea id="portfolioDescription" rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description of your portfolio strategy"></textarea>
              </div>
              <div class="flex justify-end space-x-2">
                <button type="button" onclick="portfolioManager.closeModal()"
                  class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                  Cancel
                </button>
                <button type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  <span id="submitButtonText">Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Portfolio List Modal -->
      <div id="portfolioListModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
          <div class="mt-3">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-medium text-gray-900">My Portfolios</h3>
              <button onclick="portfolioManager.openCreateModal()"
                class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center">
                <i class="fas fa-plus mr-2"></i> New Portfolio
              </button>
            </div>
            <div id="portfoliosList" class="space-y-2 max-h-96 overflow-y-auto">
              <!-- Portfolio items will be inserted here -->
            </div>
            <div class="flex justify-end mt-4">
              <button onclick="portfolioManager.closeListModal()"
                class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modalElement = document.getElementById('portfolioModal');
  }

  bindEvents() {
    // Bind form submission
    const form = document.getElementById('portfolioForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.savePortfolio();
      });
    }
  }

  async loadPortfolios() {
    try {
      const response = await fetch('/api/portfolios');
      const data = await response.json();
      
      if (response.ok) {
        this.portfolios = data.portfolios || [];
        this.updatePortfolioSelector();
        return this.portfolios;
      } else {
        console.error('Failed to load portfolios:', data.error);
        this.showNotification('Failed to load portfolios', 'error');
      }
    } catch (error) {
      console.error('Error loading portfolios:', error);
      this.showNotification('Error loading portfolios', 'error');
    }
    return [];
  }

  updatePortfolioSelector() {
    // Update the portfolio selector in the header if it exists
    const selector = document.getElementById('portfolioSelector');
    if (selector) {
      selector.innerHTML = this.portfolios.map(p => `
        <option value="${p.id}" ${p.id == this.currentPortfolioId ? 'selected' : ''}>
          ${p.name} (${this.formatCurrency(p.current_value || 0)})
        </option>
      `).join('');
    }
  }

  showPortfolioList() {
    const modal = document.getElementById('portfolioListModal');
    const listContainer = document.getElementById('portfoliosList');
    
    if (listContainer) {
      listContainer.innerHTML = this.portfolios.map(p => `
        <div class="border rounded-lg p-4 hover:bg-gray-50 ${p.id == this.currentPortfolioId ? 'border-blue-500 bg-blue-50' : ''}">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="flex items-center">
                <h4 class="font-semibold text-gray-900">${p.name}</h4>
                ${p.id == this.currentPortfolioId ? '<span class="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">Active</span>' : ''}
                ${p.id == 1 ? '<span class="ml-2 text-xs bg-gray-500 text-white px-2 py-1 rounded">Default</span>' : ''}
              </div>
              ${p.description ? `<p class="text-sm text-gray-600 mt-1">${p.description}</p>` : ''}
              <div class="flex items-center mt-2 text-sm text-gray-500">
                <span class="mr-4">
                  <i class="fas fa-chart-line mr-1"></i>
                  ${p.holdings_count || 0} holdings
                </span>
                <span class="mr-4">
                  <i class="fas fa-dollar-sign mr-1"></i>
                  ${this.formatCurrency(p.current_value || 0)}
                </span>
                <span>
                  <i class="fas fa-calendar mr-1"></i>
                  ${new Date(p.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div class="flex space-x-2 ml-4">
              ${p.id != this.currentPortfolioId ? `
                <button onclick="portfolioManager.switchPortfolio('${p.id}')"
                  class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                  <i class="fas fa-exchange-alt"></i> Switch
                </button>
              ` : ''}
              <button onclick="portfolioManager.openEditModal('${p.id}')"
                class="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
                <i class="fas fa-edit"></i> Edit
              </button>
              ${p.id != 1 ? `
                <button onclick="portfolioManager.deletePortfolio('${p.id}')"
                  class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
                  <i class="fas fa-trash"></i> Delete
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }
    
    modal.classList.remove('hidden');
  }

  closeListModal() {
    document.getElementById('portfolioListModal').classList.add('hidden');
  }

  openCreateModal() {
    document.getElementById('modalTitle').textContent = 'Create New Portfolio';
    document.getElementById('submitButtonText').textContent = 'Create';
    document.getElementById('portfolioId').value = '';
    document.getElementById('portfolioName').value = '';
    document.getElementById('portfolioDescription').value = '';
    this.modalElement.classList.remove('hidden');
  }

  openEditModal(portfolioId) {
    const portfolio = this.portfolios.find(p => p.id == portfolioId);
    if (!portfolio) return;

    document.getElementById('modalTitle').textContent = 'Edit Portfolio';
    document.getElementById('submitButtonText').textContent = 'Update';
    document.getElementById('portfolioId').value = portfolio.id;
    document.getElementById('portfolioName').value = portfolio.name;
    document.getElementById('portfolioDescription').value = portfolio.description || '';
    this.modalElement.classList.remove('hidden');
  }

  closeModal() {
    this.modalElement.classList.add('hidden');
  }

  async savePortfolio() {
    const portfolioId = document.getElementById('portfolioId').value;
    const name = document.getElementById('portfolioName').value.trim();
    const description = document.getElementById('portfolioDescription').value.trim();

    if (!name) {
      this.showNotification('Portfolio name is required', 'error');
      return;
    }

    try {
      const url = portfolioId ? `/api/portfolios/${portfolioId}` : '/api/portfolios';
      const method = portfolioId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, description })
      });

      const data = await response.json();
      
      if (response.ok) {
        this.showNotification(data.message || 'Portfolio saved successfully', 'success');
        this.closeModal();
        await this.loadPortfolios();
        this.showPortfolioList();
        
        // If creating a new portfolio, optionally switch to it
        if (!portfolioId && data.portfolio) {
          const shouldSwitch = confirm('Would you like to switch to the new portfolio?');
          if (shouldSwitch) {
            await this.switchPortfolio(data.portfolio.id);
          }
        }
      } else {
        this.showNotification(data.error || 'Failed to save portfolio', 'error');
      }
    } catch (error) {
      console.error('Error saving portfolio:', error);
      this.showNotification('Error saving portfolio', 'error');
    }
  }

  async deletePortfolio(portfolioId) {
    const portfolio = this.portfolios.find(p => p.id == portfolioId);
    if (!portfolio) return;

    if (!confirm(`Are you sure you want to delete "${portfolio.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/portfolios/${portfolioId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (response.ok) {
        this.showNotification(data.message || 'Portfolio deleted successfully', 'success');
        await this.loadPortfolios();
        this.showPortfolioList();
        
        // If deleted the current portfolio, switch to default
        if (portfolioId == this.currentPortfolioId) {
          await this.switchPortfolio('1');
        }
      } else {
        this.showNotification(data.error || 'Failed to delete portfolio', 'error');
      }
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      this.showNotification('Error deleting portfolio', 'error');
    }
  }

  async switchPortfolio(portfolioId) {
    this.currentPortfolioId = portfolioId;
    localStorage.setItem('selectedPortfolioId', portfolioId);
    
    // Update the selector if it exists
    this.updatePortfolioSelector();
    
    // Trigger portfolio switch event for the main app
    window.dispatchEvent(new CustomEvent('portfolioChanged', { 
      detail: { portfolioId } 
    }));
    
    this.showNotification('Switched portfolio successfully', 'success');
    this.closeListModal();
    
    // Reload the main app data
    if (window.app) {
      window.app.portfolioId = portfolioId;
      await window.app.loadPortfolio();
      await window.app.loadWatchlist();
    }
  }

  getCurrentPortfolioId() {
    return this.currentPortfolioId;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[60] ${
      type === 'success' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 
      'bg-blue-500'
    } text-white`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize portfolio manager when DOM is ready
let portfolioManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    portfolioManager = new PortfolioManager();
  });
} else {
  portfolioManager = new PortfolioManager();
}