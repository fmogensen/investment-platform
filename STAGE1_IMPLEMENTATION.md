# Stage 1: Enhanced Data & Analytics - Implementation Guide

## Overview
This document provides detailed technical implementation steps for Stage 1 of the development plan, focusing on enhanced data visualization and portfolio analytics.

---

## 1.1 Historical Performance Charts

### Technical Stack
- **Charting Library**: Chart.js with financial plugins
- **Data Storage**: Cloudflare D1 for historical data
- **Caching**: Cloudflare KV with 5-minute TTL
- **API Integration**: Alpha Vantage for historical data

### Database Schema Updates
```sql
-- Historical price data table
CREATE TABLE price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  security_id INTEGER NOT NULL,
  date DATE NOT NULL,
  open DECIMAL(10, 2),
  high DECIMAL(10, 2),
  low DECIMAL(10, 2),
  close DECIMAL(10, 2) NOT NULL,
  volume BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (security_id) REFERENCES securities(id),
  UNIQUE(security_id, date)
);

-- Portfolio snapshots for performance tracking
CREATE TABLE portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL,
  date DATE NOT NULL,
  total_value DECIMAL(15, 2) NOT NULL,
  total_cost DECIMAL(15, 2) NOT NULL,
  daily_change DECIMAL(10, 2),
  daily_change_percent DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id),
  UNIQUE(portfolio_id, date)
);

-- Benchmark data for comparison
CREATE TABLE benchmark_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  change_percent DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, date)
);
```

### API Endpoints
```typescript
// Get historical portfolio performance
app.get('/api/portfolio/:id/history', async (c) => {
  const { id } = c.req.param();
  const { period = '1M' } = c.req.query();
  
  // Calculate date range based on period
  const startDate = calculateStartDate(period);
  
  const history = await c.env.DB.prepare(`
    SELECT date, total_value, daily_change_percent
    FROM portfolio_snapshots
    WHERE portfolio_id = ? AND date >= ?
    ORDER BY date ASC
  `).bind(id, startDate).all();
  
  return c.json({ history: history.results });
});

// Get benchmark comparison data
app.get('/api/portfolio/:id/benchmark', async (c) => {
  const { id } = c.req.param();
  const { benchmark = 'SPY', period = '1M' } = c.req.query();
  
  // Fetch portfolio and benchmark data
  const data = await Promise.all([
    getPortfolioHistory(id, period),
    getBenchmarkHistory(benchmark, period)
  ]);
  
  return c.json({
    portfolio: data[0],
    benchmark: data[1],
    correlation: calculateCorrelation(data[0], data[1])
  });
});
```

### Frontend Components
```javascript
class PerformanceChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
    this.periods = ['1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];
    this.currentPeriod = '1M';
  }
  
  async render(portfolioId) {
    const data = await this.fetchData(portfolioId);
    
    this.chart = new Chart(this.canvas, {
      type: 'line',
      data: {
        labels: data.dates,
        datasets: [{
          label: 'Portfolio Value',
          data: data.values,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1
        }, {
          label: 'S&P 500',
          data: data.benchmark,
          borderColor: 'rgb(156, 163, 175)',
          borderDash: [5, 5],
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                const change = this.calculateChange(context.dataIndex);
                return `${context.dataset.label}: $${value.toFixed(2)} (${change}%)`;
              }
            }
          }
        }
      }
    });
  }
}
```

---

## 1.2 Risk Metrics Implementation

### Calculation Services
```typescript
class RiskMetricsCalculator {
  // Calculate portfolio beta
  calculateBeta(portfolioReturns: number[], marketReturns: number[]): number {
    const covariance = this.calculateCovariance(portfolioReturns, marketReturns);
    const marketVariance = this.calculateVariance(marketReturns);
    return covariance / marketVariance;
  }
  
  // Calculate Sharpe Ratio
  calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = this.calculateStandardDeviation(returns);
    return (avgReturn - riskFreeRate) / stdDev;
  }
  
  // Calculate maximum drawdown
  calculateMaxDrawdown(values: number[]): number {
    let maxDrawdown = 0;
    let peak = values[0];
    
    for (const value of values) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown * 100;
  }
  
  // Value at Risk (VaR) calculation
  calculateVaR(returns: number[], confidence: number = 0.95): number {
    const sorted = returns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    return sorted[index];
  }
}
```

### Risk Dashboard Component
```javascript
class RiskMetricsDashboard {
  async render(portfolioId) {
    const metrics = await this.fetchRiskMetrics(portfolioId);
    
    return `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="metric-card">
          <h4 class="text-sm text-gray-600 dark:text-gray-400">Beta</h4>
          <p class="text-2xl font-bold ${this.getBetaColor(metrics.beta)}">
            ${metrics.beta.toFixed(2)}
          </p>
          <p class="text-xs text-gray-500">vs S&P 500</p>
        </div>
        
        <div class="metric-card">
          <h4 class="text-sm text-gray-600 dark:text-gray-400">Volatility</h4>
          <p class="text-2xl font-bold">
            ${metrics.volatility.toFixed(1)}%
          </p>
          <p class="text-xs text-gray-500">Annual</p>
        </div>
        
        <div class="metric-card">
          <h4 class="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</h4>
          <p class="text-2xl font-bold ${this.getSharpeColor(metrics.sharpe)}">
            ${metrics.sharpe.toFixed(2)}
          </p>
          <p class="text-xs text-gray-500">Risk-adjusted return</p>
        </div>
        
        <div class="metric-card">
          <h4 class="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</h4>
          <p class="text-2xl font-bold text-red-600">
            -${metrics.maxDrawdown.toFixed(1)}%
          </p>
          <p class="text-xs text-gray-500">Peak to trough</p>
        </div>
      </div>
    `;
  }
}
```

---

## 1.3 Sector & Geographic Analysis

### Data Models
```sql
-- Sector allocation tracking
CREATE TABLE sector_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL,
  sector VARCHAR(50) NOT NULL,
  allocation_percent DECIMAL(5, 2) NOT NULL,
  market_value DECIMAL(15, 2) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
);

-- Geographic allocation
CREATE TABLE geographic_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL,
  country VARCHAR(50) NOT NULL,
  region VARCHAR(50),
  allocation_percent DECIMAL(5, 2) NOT NULL,
  market_value DECIMAL(15, 2) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
);
```

### Visualization Components
```javascript
class AllocationCharts {
  renderSectorChart(data) {
    return new Chart(this.sectorCanvas, {
      type: 'doughnut',
      data: {
        labels: data.sectors,
        datasets: [{
          data: data.values,
          backgroundColor: [
            '#3b82f6', // Technology
            '#10b981', // Healthcare
            '#f59e0b', // Finance
            '#ef4444', // Energy
            '#8b5cf6', // Consumer
            '#ec4899', // Industrial
            '#14b8a6', // Materials
            '#f97316', // Real Estate
            '#6366f1', // Utilities
            '#84cc16'  // Communications
          ]
        }]
      },
      options: {
        plugins: {
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label;
                const value = context.parsed;
                const percent = ((value / data.total) * 100).toFixed(1);
                return `${label}: $${value.toFixed(2)} (${percent}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  renderGeographicMap(data) {
    // Use D3.js for geographic visualization
    const svg = d3.select('#geographic-map')
      .append('svg')
      .attr('width', 800)
      .attr('height', 400);
    
    // Load world map data
    d3.json('/static/world-map.json').then(world => {
      // Render choropleth map based on allocation data
      svg.selectAll('path')
        .data(world.features)
        .enter()
        .append('path')
        .attr('d', d3.geoPath())
        .attr('fill', d => {
          const allocation = data.find(a => a.country === d.properties.name);
          return allocation ? this.getColorScale(allocation.percent) : '#e5e7eb';
        })
        .on('mouseover', (event, d) => {
          // Show tooltip with allocation details
        });
    });
  }
}
```

---

## 1.4 Dividend Tracking

### Database Schema
```sql
CREATE TABLE dividend_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  security_id INTEGER NOT NULL,
  ex_date DATE NOT NULL,
  payment_date DATE,
  amount DECIMAL(10, 4) NOT NULL,
  frequency VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE dividend_projections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  projected_amount DECIMAL(15, 2) NOT NULL,
  actual_amount DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
);
```

### Dividend Dashboard
```javascript
class DividendTracker {
  async renderDashboard(portfolioId) {
    const data = await this.fetchDividendData(portfolioId);
    
    return `
      <div class="dividend-dashboard">
        <div class="summary-cards grid grid-cols-3 gap-4 mb-6">
          <div class="card">
            <h3>Annual Dividend Income</h3>
            <p class="text-2xl font-bold">$${data.annualIncome.toFixed(2)}</p>
            <p class="text-sm text-gray-500">+${data.yoyGrowth}% YoY</p>
          </div>
          
          <div class="card">
            <h3>Dividend Yield</h3>
            <p class="text-2xl font-bold">${data.yield.toFixed(2)}%</p>
            <p class="text-sm text-gray-500">Portfolio average</p>
          </div>
          
          <div class="card">
            <h3>Next Payment</h3>
            <p class="text-2xl font-bold">$${data.nextPayment.amount.toFixed(2)}</p>
            <p class="text-sm text-gray-500">${data.nextPayment.date}</p>
          </div>
        </div>
        
        <div class="dividend-calendar">
          ${this.renderDividendCalendar(data.calendar)}
        </div>
        
        <div class="dividend-growth-chart">
          <canvas id="dividendGrowthChart"></canvas>
        </div>
      </div>
    `;
  }
}
```

---

## Implementation Timeline for Stage 1

### Week 1-2: Database & API Setup
- [ ] Create database migrations
- [ ] Implement historical data fetching
- [ ] Set up data synchronization jobs
- [ ] Create API endpoints

### Week 3-4: Core Analytics
- [ ] Implement risk metrics calculator
- [ ] Build performance tracking
- [ ] Create benchmark comparison
- [ ] Develop allocation analysis

### Week 5-6: Visualization & UI
- [ ] Integrate Chart.js components
- [ ] Build dashboard layouts
- [ ] Create interactive charts
- [ ] Implement period selectors
- [ ] Add export functionality

### Testing & Deployment
- [ ] Unit tests for calculations
- [ ] Integration tests for APIs
- [ ] Performance optimization
- [ ] User acceptance testing
- [ ] Production deployment

---

## Performance Considerations

### Caching Strategy
```typescript
// Use Cloudflare KV for caching expensive calculations
const CACHE_TTL = 300; // 5 minutes

async function getCachedMetrics(portfolioId: string, env: Env) {
  const cacheKey = `metrics:${portfolioId}`;
  const cached = await env.KV.get(cacheKey, 'json');
  
  if (cached) {
    return cached;
  }
  
  const metrics = await calculateMetrics(portfolioId);
  await env.KV.put(cacheKey, JSON.stringify(metrics), {
    expirationTtl: CACHE_TTL
  });
  
  return metrics;
}
```

### Data Aggregation
```sql
-- Use materialized views for performance
CREATE VIEW portfolio_performance_summary AS
SELECT 
  p.id,
  p.name,
  ps.total_value,
  ps.daily_change_percent,
  (ps.total_value - p30.total_value) / p30.total_value * 100 as month_change,
  (ps.total_value - p365.total_value) / p365.total_value * 100 as year_change
FROM portfolios p
JOIN portfolio_snapshots ps ON p.id = ps.portfolio_id
LEFT JOIN portfolio_snapshots p30 ON p.id = p30.portfolio_id 
  AND p30.date = date('now', '-30 days')
LEFT JOIN portfolio_snapshots p365 ON p.id = p365.portfolio_id 
  AND p365.date = date('now', '-365 days')
WHERE ps.date = date('now');
```

---

## Next Steps

1. Review technical specifications with team
2. Set up development environment
3. Create detailed test plans
4. Begin implementation of database schema
5. Start API development in parallel with UI components

This implementation guide provides the foundation for Stage 1 development. Each subsequent stage will build upon these core analytics capabilities.