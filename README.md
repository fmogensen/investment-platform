# Investment Platform - Real-Time Stock & ETF Portfolio Manager

## Project Overview
- **Name**: Investment Platform  
- **Goal**: A comprehensive web-based investment platform for managing stock and ETF portfolios with real-time market data
- **Features**: Portfolio management, real-time stock quotes, buy/sell transactions, watchlist, performance tracking, portfolio analytics, and multi-API provider support
- **NO SAMPLE DATA**: This platform uses ONLY real market data from configured APIs

## Live Demo
- **Production URL**: https://3000-i865ldkdokweyyzxlz8oy-6532622b.e2b.dev
- **Admin Panel**: https://3000-i865ldkdokweyyzxlz8oy-6532622b.e2b.dev/admin
- **Status**: ✅ Active (Development)

## Currently Completed Features

### ✅ Portfolio Management
- View portfolio summary with total value, cost basis, and returns
- Track individual holdings with real-time profit/loss calculations
- Portfolio allocation visualization with interactive charts
- Support for multiple portfolios (database structure ready)

### ✅ Stock Trading
- Buy stocks and ETFs with quantity and price inputs
- Sell positions with profit/loss calculations
- Average cost basis calculation for multiple purchases
- Transaction history tracking with timestamps

### ✅ Market Data Integration - REAL DATA ONLY
- **NO SAMPLE/DEMO DATA** - All data comes from real market APIs
- Multi-provider support with automatic failover
- Real-time stock quotes from Twelve Data, Alpha Vantage, and Finnhub
- Automatic price updates every 60 seconds
- Smart caching system to optimize API usage
- Admin panel for API configuration and monitoring

### ✅ Search & Discovery
- Search stocks and ETFs by symbol or company name
- Quick access to stock quotes and key metrics
- One-click buy/watch actions from search results

### ✅ Watchlist
- Add stocks to watchlist with target prices
- Notes and alerts for investment opportunities
- Quick access to buy stocks from watchlist

### ✅ Data Visualization
- Portfolio allocation doughnut chart
- Color-coded profit/loss indicators
- Responsive tables with sortable data

### ✅ Admin Panel
- Secure admin authentication
- Configure multiple API providers
- Set default API provider
- Test API connections in real-time
- Monitor API usage and performance
- View error rates and response times
- Manage general platform settings

## API Configuration

### Configured API Providers

The platform now supports multiple API providers with automatic failover:

1. **Twelve Data API** ✅ CONFIGURED
   - API Key: 995c958f068840e387872c2714be6a41
   - Free tier: 800 API calls/day, 8 requests/minute
   - Documentation: https://twelvedata.com/docs

2. **Alpha Vantage API** ✅ CONFIGURED
   - API Key: LO740ATBJCE6J4W9
   - Free tier: 25 API calls/day (basic), 500/day (premium)
   - Documentation: https://www.alphavantage.co/documentation/

3. **Finnhub API** ✅ CONFIGURED
   - API Key: d2v9hm1r01qq994iptt0d2v9hm1r01qq994ipttg
   - Free tier: 60 API calls/minute
   - Documentation: https://finnhub.io/docs/api

### Admin Panel for API Management

**Access the Admin Panel**: `/admin`
- Default Password: `admin123`
- Features:
  - Configure API keys for all providers
  - Set default/primary API provider
  - Test each API with real-time feedback
  - Monitor API usage and response times
  - View error rates and performance metrics
  - Automatic failover configuration

### NO SAMPLE DATA POLICY

⚠️ **IMPORTANT**: This platform NEVER uses sample or demo data. All stock prices, quotes, and market data come from real API providers. If APIs are not configured or fail, the platform will show appropriate error messages rather than fake data.

## API Endpoints

### Portfolio Management
- `GET /api/portfolio/:id` - Get portfolio details with holdings
- `POST /api/portfolio/:id/buy` - Buy stocks (params: symbol, quantity, price)
- `POST /api/portfolio/:id/sell` - Sell stocks (params: symbol, quantity, price)

### Market Data
- `GET /api/search?q=<query>` - Search stocks and ETFs
- `GET /api/quote/:symbol` - Get real-time stock quote
- `POST /api/update-prices` - Batch update all portfolio prices

### Watchlist
- `GET /api/watchlist` - Get user's watchlist
- `POST /api/watchlist` - Add to watchlist (params: symbol, targetPrice, notes)

### Transactions
- `GET /api/transactions/:portfolioId` - Get transaction history

### Admin APIs
- `GET /api/admin/config` - Get API configuration (requires auth)
- `POST /api/admin/config` - Update API configuration (requires auth)
- `POST /api/admin/settings` - Update platform settings (requires auth)
- `POST /api/admin/test-api` - Test API provider (requires auth)

## Data Architecture

### Data Models
- **Users**: Multi-user support structure
- **Portfolios**: Portfolio containers with metadata
- **Securities**: Cached stock/ETF data
- **Holdings**: Current positions with cost basis
- **Transactions**: Buy/sell history
- **Watchlist**: Tracked securities with alerts
- **Price History**: Historical data for charts
- **API Providers**: Configuration for multiple data sources
- **API Usage**: Tracking and monitoring API calls
- **Admin Settings**: Platform configuration

### Storage Services
- **Cloudflare D1**: SQLite database for all relational data
- **Cloudflare KV**: Cache for API responses (5-minute TTL)
- **Local Development**: SQLite with `--local` flag

## User Guide

### Getting Started
1. Visit the platform URL
2. The default portfolio is automatically loaded
3. Start by searching for stocks in the Search tab

### How to Buy Stocks
1. Go to the Search tab
2. Enter a stock symbol or company name
3. Click "Buy" on the desired stock
4. Enter quantity and confirm the price
5. Click "Confirm Purchase"

### How to Sell Stocks
1. Go to Portfolio tab
2. Find the stock you want to sell
3. Click the red minus icon
4. Enter quantity to sell
5. Review profit/loss and confirm

### Managing Your Watchlist
1. Search for a stock
2. Click "Watch" button
3. Optionally set a target price
4. Add notes about why you're watching
5. View all watched stocks in Watchlist tab

### Admin Configuration
1. Navigate to `/admin`
2. Enter password: `admin123`
3. Configure API keys for each provider
4. Test APIs to ensure they work
5. Set your preferred default provider
6. Monitor usage and performance

### Portfolio Analytics
- **Total Value**: Current market value of all holdings
- **Total Cost**: Original investment amount
- **Total Gain/Loss**: Absolute profit/loss
- **Return %**: Percentage return on investment
- **Allocation Chart**: Visual breakdown of portfolio

## Tech Stack
- **Backend**: Hono Framework on Cloudflare Workers
- **Frontend**: Vanilla JavaScript with TailwindCSS
- **Database**: Cloudflare D1 (SQLite)
- **Caching**: Cloudflare KV Storage
- **Charts**: Chart.js
- **Icons**: Font Awesome
- **Deployment**: Cloudflare Pages
- **API Management**: Custom multi-provider system with failover

## Development Setup

### Prerequisites
- Node.js 18+
- Wrangler CLI
- API keys for at least one provider

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd webapp

# Install dependencies
npm install

# Configure API keys in .dev.vars
# (Already configured with your keys)

# Build the application
npm run build

# Start local development
npm run dev:d1
```

### Database Setup
```bash
# Apply migrations locally
npm run db:migrate:local

# Seed with sample data (optional)
npm run db:seed

# Reset database (development only)
npm run db:reset
```

## Features Not Yet Implemented

### 📊 Advanced Analytics
- Historical price charts
- Performance comparison with market indices
- Risk metrics (beta, volatility)
- Dividend tracking

### 📱 User Experience
- Mobile app version
- Dark mode theme
- Export to CSV/PDF
- Email notifications

### 🔐 Security & Auth
- User authentication system
- Multi-user portfolio support
- Role-based access control
- 2FA authentication

### 🚀 Advanced Trading
- Limit orders
- Stop-loss orders
- Options trading support
- Cryptocurrency support

## Recommended Next Steps

1. **Add Authentication**: Implement user login system using Cloudflare Access or Auth0
2. **Enhanced Charts**: Add historical price charts using more detailed time series data
3. **Mobile Optimization**: Improve responsive design for mobile devices
4. **More API Providers**: Add support for Polygon.io, IEX Cloud, Yahoo Finance
5. **Performance Metrics**: Add more advanced portfolio analytics (Sharpe ratio, etc.)
6. **Export Features**: Allow users to export portfolio data and reports
7. **Notifications**: Implement price alerts and portfolio notifications
8. **Social Features**: Add portfolio sharing and investment discussions

## Deployment to Production

### Cloudflare Pages Deployment
```bash
# Build for production
npm run build

# Deploy to Cloudflare Pages
npm run deploy:prod

# Set production secrets for each API
wrangler secret put TWELVE_DATA_API_KEY --project-name investment-platform
wrangler secret put ALPHA_VANTAGE_API_KEY --project-name investment-platform
wrangler secret put FINNHUB_API_KEY --project-name investment-platform
wrangler secret put ADMIN_PASSWORD --project-name investment-platform
```

### Configuration
- Update `wrangler.jsonc` with production database IDs
- Configure custom domain in Cloudflare dashboard
- Set up API rate limiting and caching rules
- Update admin password for production

## Contributing

This is an open-source project. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - Feel free to use this project for personal or commercial purposes.

## Support

For issues or questions, please open an issue on GitHub or contact the development team.

---

**Last Updated**: January 2025  
**Version**: 2.0.0  
**API Status**: ✅ All APIs Configured and Active  
**Data Source**: 100% Real Market Data (NO SAMPLE DATA)  
**Status**: Active Development