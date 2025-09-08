// SaaS Dashboard Layout Manager
class DashboardLayout {
  constructor() {
    this.theme = localStorage.getItem('theme') || 'light';
    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    this.userProfile = {
      name: localStorage.getItem('userName') || 'John Doe',
      email: localStorage.getItem('userEmail') || 'john.doe@example.com',
      avatar: localStorage.getItem('userAvatar') || null
    };
    this.init();
  }

  init() {
    this.applyTheme();
    this.injectStyles();
    this.renderLayout();
    this.bindEvents();
  }

  injectStyles() {
    const styleId = 'dashboard-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        :root {
          --sidebar-width: 260px;
          --sidebar-collapsed-width: 80px;
          --header-height: 64px;
          --transition-speed: 0.3s;
        }

        /* Light Theme Variables */
        .light {
          --bg-primary: #ffffff;
          --bg-secondary: #f8f9fa;
          --bg-sidebar: #1e293b;
          --bg-hover: #f3f4f6;
          --text-primary: #1f2937;
          --text-secondary: #6b7280;
          --text-sidebar: #e2e8f0;
          --text-sidebar-hover: #ffffff;
          --border-color: #e5e7eb;
          --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        /* Dark Theme Variables */
        .dark {
          --bg-primary: #1f2937;
          --bg-secondary: #111827;
          --bg-sidebar: #0f172a;
          --bg-hover: #374151;
          --text-primary: #f9fafb;
          --text-secondary: #9ca3af;
          --text-sidebar: #cbd5e1;
          --text-sidebar-hover: #f1f5f9;
          --border-color: #374151;
          --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
          --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);
        }

        /* Dashboard Layout */
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: var(--bg-secondary);
          color: var(--text-primary);
          transition: background-color var(--transition-speed), color var(--transition-speed);
        }

        .dashboard-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }

        /* Sidebar Styles */
        .sidebar {
          width: var(--sidebar-width);
          background: var(--bg-sidebar);
          transition: width var(--transition-speed);
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 30;
        }

        .sidebar.collapsed {
          width: var(--sidebar-collapsed-width);
        }

        .sidebar-header {
          padding: 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: var(--header-height);
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          color: var(--text-sidebar);
          font-size: 1.25rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
        }

        .sidebar-logo i {
          font-size: 1.5rem;
          margin-right: 0.75rem;
          min-width: 24px;
        }

        .sidebar.collapsed .sidebar-logo span {
          display: none;
        }

        .sidebar-toggle {
          background: none;
          border: none;
          color: var(--text-sidebar);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.375rem;
          transition: background-color 0.2s;
        }

        .sidebar-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .sidebar-nav {
          flex: 1;
          padding: 1rem 0;
          overflow-y: auto;
        }

        .nav-item {
          margin: 0.25rem 0.75rem;
        }

        .nav-link {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          color: var(--text-sidebar);
          text-decoration: none;
          border-radius: 0.5rem;
          transition: all 0.2s;
          position: relative;
          white-space: nowrap;
        }

        .nav-link:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-sidebar-hover);
        }

        .nav-link.active {
          background: rgba(59, 130, 246, 0.5);
          color: #ffffff;
        }

        .nav-link.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 24px;
          background: #3b82f6;
          border-radius: 0 2px 2px 0;
        }

        .nav-link i {
          font-size: 1.25rem;
          min-width: 24px;
          margin-right: 0.75rem;
        }

        .sidebar.collapsed .nav-link span {
          display: none;
        }

        .sidebar.collapsed .nav-link {
          justify-content: center;
          padding: 0.75rem;
        }

        .sidebar.collapsed .nav-link i {
          margin-right: 0;
        }

        /* Main Content Area */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Top Header */
        .top-header {
          height: var(--header-height);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.5rem;
          box-shadow: var(--shadow);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .breadcrumb-item {
          display: flex;
          align-items: center;
        }

        .breadcrumb-separator {
          margin: 0 0.25rem;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        /* Theme Toggle */
        .theme-toggle {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 2rem;
          padding: 0.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          transition: all 0.2s;
        }

        .theme-toggle:hover {
          box-shadow: var(--shadow);
        }

        .theme-toggle-option {
          padding: 0.5rem;
          border-radius: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .theme-toggle-option.active {
          background: var(--bg-primary);
          color: #3b82f6;
          box-shadow: var(--shadow);
        }

        .theme-toggle-option:not(.active) {
          color: var(--text-secondary);
        }

        /* Notifications */
        .notifications-btn {
          position: relative;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.5rem;
          transition: background-color 0.2s;
        }

        .notifications-btn:hover {
          background: var(--bg-hover);
        }

        .notification-badge {
          position: absolute;
          top: 0.25rem;
          right: 0.25rem;
          background: #ef4444;
          color: white;
          font-size: 0.625rem;
          padding: 0.125rem 0.25rem;
          border-radius: 9999px;
          min-width: 16px;
          text-align: center;
        }

        /* User Profile Dropdown */
        .user-profile {
          position: relative;
        }

        .user-profile-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .user-profile-btn:hover {
          box-shadow: var(--shadow);
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
        }

        .user-info {
          text-align: left;
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .user-role {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .user-dropdown {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          box-shadow: var(--shadow-lg);
          min-width: 200px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.2s;
          z-index: 50;
        }

        .user-dropdown.show {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          color: var(--text-primary);
          text-decoration: none;
          transition: background-color 0.2s;
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
        }

        .dropdown-item:hover {
          background: var(--bg-hover);
        }

        .dropdown-divider {
          height: 1px;
          background: var(--border-color);
          margin: 0.5rem 0;
        }

        /* Content Area */
        .content-area {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .page-content {
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Cards */
        .card {
          background: var(--bg-primary);
          border-radius: 0.75rem;
          box-shadow: var(--shadow);
          margin-bottom: 1.5rem;
          transition: all 0.3s;
        }

        .card-header {
          padding: 1.25rem;
          border-bottom: 1px solid var(--border-color);
        }

        .card-body {
          padding: 1.25rem;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: -100%;
            height: 100vh;
            z-index: 50;
            transition: left var(--transition-speed);
          }

          .sidebar.mobile-open {
            left: 0;
          }

          .sidebar-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 40;
          }

          .sidebar-overlay.show {
            display: block;
          }

          .user-info {
            display: none;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  applyTheme() {
    document.documentElement.className = this.theme;
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.theme);
    this.applyTheme();
    this.updateThemeToggle();
  }

  updateThemeToggle() {
    const lightOption = document.querySelector('.theme-toggle-option[data-theme="light"]');
    const darkOption = document.querySelector('.theme-toggle-option[data-theme="dark"]');
    
    if (this.theme === 'light') {
      lightOption?.classList.add('active');
      darkOption?.classList.remove('active');
    } else {
      darkOption?.classList.add('active');
      lightOption?.classList.remove('active');
    }
  }

  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
    this.sidebarCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed);
  }

  toggleUserDropdown() {
    const dropdown = document.querySelector('.user-dropdown');
    dropdown.classList.toggle('show');
  }

  renderLayout() {
    const app = document.getElementById('app');
    
    app.innerHTML = `
      <div class="dashboard-container">
        <!-- Sidebar -->
        <aside class="sidebar ${this.sidebarCollapsed ? 'collapsed' : ''}">
          <div class="sidebar-header">
            <div class="sidebar-logo">
              <i class="fas fa-chart-line"></i>
              <span>InvestHub</span>
            </div>
            <button class="sidebar-toggle" onclick="dashboardLayout.toggleSidebar()">
              <i class="fas fa-bars"></i>
            </button>
          </div>
          
          <nav class="sidebar-nav">
            <div class="nav-item">
              <a href="#" class="nav-link active" data-view="portfolio">
                <i class="fas fa-briefcase"></i>
                <span>Portfolio</span>
              </a>
            </div>
            <div class="nav-item">
              <a href="#" class="nav-link" data-view="search">
                <i class="fas fa-search"></i>
                <span>Market Search</span>
              </a>
            </div>
            <div class="nav-item">
              <a href="#" class="nav-link" data-view="watchlist">
                <i class="fas fa-star"></i>
                <span>Watchlist</span>
              </a>
            </div>
            <div class="nav-item">
              <a href="#" class="nav-link" data-view="transactions">
                <i class="fas fa-history"></i>
                <span>Transactions</span>
              </a>
            </div>
            <div class="nav-item">
              <a href="#" class="nav-link" data-view="analytics">
                <i class="fas fa-chart-pie"></i>
                <span>Analytics</span>
              </a>
            </div>
            <div class="nav-item">
              <a href="#" class="nav-link" data-view="settings">
                <i class="fas fa-cog"></i>
                <span>Settings</span>
              </a>
            </div>
          </nav>
        </aside>
        
        <!-- Overlay for mobile -->
        <div class="sidebar-overlay" onclick="dashboardLayout.closeMobileSidebar()"></div>
        
        <!-- Main Content -->
        <main class="main-content">
          <!-- Top Header -->
          <header class="top-header">
            <div class="header-left">
              <button class="sidebar-toggle-mobile md:hidden" onclick="dashboardLayout.openMobileSidebar()">
                <i class="fas fa-bars"></i>
              </button>
              <nav class="breadcrumb">
                <span class="breadcrumb-item">Dashboard</span>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-item" id="currentPage">Portfolio</span>
              </nav>
            </div>
            
            <div class="header-right">
              <!-- Portfolio Selector -->
              <select id="portfolioSelector" 
                      class="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <!-- Options will be populated by PortfolioManager -->
              </select>
              
              <button onclick="portfolioManager.showPortfolioList()"
                      class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition">
                <i class="fas fa-folder-plus"></i> Manage
              </button>
              
              <!-- Theme Toggle -->
              <div class="theme-toggle" onclick="dashboardLayout.toggleTheme()">
                <div class="theme-toggle-option" data-theme="light">
                  <i class="fas fa-sun"></i>
                </div>
                <div class="theme-toggle-option" data-theme="dark">
                  <i class="fas fa-moon"></i>
                </div>
              </div>
              
              <!-- Notifications -->
              <button class="notifications-btn">
                <i class="fas fa-bell"></i>
                <span class="notification-badge">3</span>
              </button>
              
              <!-- User Profile -->
              <div class="user-profile">
                <button class="user-profile-btn" onclick="dashboardLayout.toggleUserDropdown()">
                  <div class="user-avatar">
                    ${this.userProfile.avatar ? 
                      `<img src="${this.userProfile.avatar}" alt="User">` : 
                      this.userProfile.name.charAt(0).toUpperCase()
                    }
                  </div>
                  <div class="user-info">
                    <div class="user-name">${this.userProfile.name}</div>
                    <div class="user-role">Investor</div>
                  </div>
                  <i class="fas fa-chevron-down text-gray-400"></i>
                </button>
                
                <div class="user-dropdown">
                  <a href="#" class="dropdown-item" data-action="profile">
                    <i class="fas fa-user"></i>
                    <span>My Profile</span>
                  </a>
                  <a href="#" class="dropdown-item" data-action="preferences">
                    <i class="fas fa-sliders-h"></i>
                    <span>Preferences</span>
                  </a>
                  <a href="#" class="dropdown-item" data-action="billing">
                    <i class="fas fa-credit-card"></i>
                    <span>Billing</span>
                  </a>
                  <div class="dropdown-divider"></div>
                  <a href="/admin" class="dropdown-item">
                    <i class="fas fa-tools"></i>
                    <span>Admin Panel</span>
                  </a>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item text-red-600" data-action="logout">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </header>
          
          <!-- Content Area -->
          <div class="content-area">
            <div class="page-content" id="content">
              <!-- Dynamic content will be loaded here -->
            </div>
          </div>
        </main>
      </div>
    `;
    
    // Update theme toggle state
    this.updateThemeToggle();
  }

  bindEvents() {
    // Close user dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-profile')) {
        document.querySelector('.user-dropdown')?.classList.remove('show');
      }
    });

    // Handle navigation clicks
    document.addEventListener('click', (e) => {
      if (e.target.closest('.nav-link')) {
        e.preventDefault();
        const link = e.target.closest('.nav-link');
        const view = link.dataset.view;
        
        // Update active state
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Update breadcrumb
        document.getElementById('currentPage').textContent = link.querySelector('span').textContent;
        
        // Trigger view change in main app
        if (window.app) {
          window.app.switchView(view);
        }
      }
    });

    // Handle dropdown actions
    document.addEventListener('click', (e) => {
      if (e.target.closest('.dropdown-item')) {
        const action = e.target.closest('.dropdown-item').dataset.action;
        this.handleDropdownAction(action);
      }
    });
  }

  handleDropdownAction(action) {
    switch(action) {
      case 'profile':
        this.showProfileModal();
        break;
      case 'preferences':
        this.showPreferencesModal();
        break;
      case 'billing':
        this.showBillingModal();
        break;
      case 'logout':
        if (confirm('Are you sure you want to logout?')) {
          // Handle logout
          localStorage.clear();
          window.location.reload();
        }
        break;
    }
  }

  showProfileModal() {
    const modal = `
      <div class="modal-overlay" id="profileModal">
        <div class="modal-content" style="background: var(--bg-primary); color: var(--text-primary);">
          <h2 class="text-2xl font-bold mb-4">Edit Profile</h2>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Name</label>
              <input type="text" id="profileName" value="${this.userProfile.name}"
                     class="w-full px-3 py-2 border rounded-lg bg-transparent">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Email</label>
              <input type="email" id="profileEmail" value="${this.userProfile.email}"
                     class="w-full px-3 py-2 border rounded-lg bg-transparent">
            </div>
          </div>
          
          <div class="flex gap-2 mt-6">
            <button onclick="dashboardLayout.saveProfile()" 
                    class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Save Changes
            </button>
            <button onclick="dashboardLayout.closeModal('profileModal')" 
                    class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
  }

  saveProfile() {
    const name = document.getElementById('profileName').value;
    const email = document.getElementById('profileEmail').value;
    
    this.userProfile.name = name;
    this.userProfile.email = email;
    
    localStorage.setItem('userName', name);
    localStorage.setItem('userEmail', email);
    
    // Update UI
    document.querySelector('.user-name').textContent = name;
    document.querySelector('.user-avatar').textContent = name.charAt(0).toUpperCase();
    
    this.closeModal('profileModal');
    
    // Show notification
    if (window.app) {
      window.app.showNotification('Profile updated successfully', 'success');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.remove();
    }
  }

  openMobileSidebar() {
    document.querySelector('.sidebar').classList.add('mobile-open');
    document.querySelector('.sidebar-overlay').classList.add('show');
  }

  closeMobileSidebar() {
    document.querySelector('.sidebar').classList.remove('mobile-open');
    document.querySelector('.sidebar-overlay').classList.remove('show');
  }
}

// Initialize dashboard layout
let dashboardLayout;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    dashboardLayout = new DashboardLayout();
  });
} else {
  dashboardLayout = new DashboardLayout();
}