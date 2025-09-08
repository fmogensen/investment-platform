-- Seed data for Investment Platform

-- Insert default user
INSERT OR IGNORE INTO users (id, email, name) VALUES 
  (1, 'investor@example.com', 'Default Investor');

-- Insert default portfolio
INSERT OR IGNORE INTO portfolios (id, user_id, name, description) VALUES 
  (1, 1, 'Main Portfolio', 'My primary investment portfolio');

-- Insert sample securities (popular stocks and ETFs)
INSERT OR IGNORE INTO securities (symbol, name, type, exchange, currency, sector, industry, last_price) VALUES 
  ('AAPL', 'Apple Inc.', 'stock', 'NASDAQ', 'USD', 'Technology', 'Consumer Electronics', 195.89),
  ('MSFT', 'Microsoft Corporation', 'stock', 'NASDAQ', 'USD', 'Technology', 'Software', 415.26),
  ('GOOGL', 'Alphabet Inc.', 'stock', 'NASDAQ', 'USD', 'Technology', 'Internet Services', 139.52),
  ('AMZN', 'Amazon.com Inc.', 'stock', 'NASDAQ', 'USD', 'Consumer Cyclical', 'E-Commerce', 178.35),
  ('TSLA', 'Tesla Inc.', 'stock', 'NASDAQ', 'USD', 'Consumer Cyclical', 'Auto Manufacturers', 251.44),
  ('NVDA', 'NVIDIA Corporation', 'stock', 'NASDAQ', 'USD', 'Technology', 'Semiconductors', 875.28),
  ('META', 'Meta Platforms Inc.', 'stock', 'NASDAQ', 'USD', 'Technology', 'Social Media', 483.59),
  ('BRK.B', 'Berkshire Hathaway Inc.', 'stock', 'NYSE', 'USD', 'Financial', 'Conglomerate', 412.68),
  ('JPM', 'JPMorgan Chase & Co.', 'stock', 'NYSE', 'USD', 'Financial', 'Banking', 198.47),
  ('V', 'Visa Inc.', 'stock', 'NYSE', 'USD', 'Financial', 'Payment Services', 271.83),
  ('SPY', 'SPDR S&P 500 ETF', 'etf', 'NYSE', 'USD', 'Broad Market', 'Large Cap Blend', 452.16),
  ('QQQ', 'Invesco QQQ Trust', 'etf', 'NASDAQ', 'USD', 'Technology', 'Large Cap Growth', 440.37),
  ('VTI', 'Vanguard Total Stock Market ETF', 'etf', 'NYSE', 'USD', 'Broad Market', 'Total Market', 251.23),
  ('VOO', 'Vanguard S&P 500 ETF', 'etf', 'NYSE', 'USD', 'Broad Market', 'Large Cap Blend', 418.76),
  ('IWM', 'iShares Russell 2000 ETF', 'etf', 'NYSE', 'USD', 'Broad Market', 'Small Cap Blend', 198.54);

-- Add sample holdings to the default portfolio
INSERT OR IGNORE INTO holdings (portfolio_id, security_id, quantity, average_cost) VALUES 
  (1, 1, 50, 150.00),  -- 50 shares of AAPL at $150 average
  (1, 11, 100, 420.00), -- 100 shares of SPY at $420 average
  (1, 6, 10, 650.00);   -- 10 shares of NVDA at $650 average

-- Add sample transactions
INSERT OR IGNORE INTO transactions (portfolio_id, security_id, type, quantity, price, fees, notes) VALUES 
  (1, 1, 'buy', 50, 150.00, 5.00, 'Initial AAPL position'),
  (1, 11, 'buy', 100, 420.00, 5.00, 'SPY for market exposure'),
  (1, 6, 'buy', 10, 650.00, 5.00, 'NVDA for AI exposure');

-- Add items to watchlist
INSERT OR IGNORE INTO watchlist (user_id, security_id, target_price, notes) VALUES 
  (1, 2, 450.00, 'Waiting for pullback'),
  (1, 3, 135.00, 'Monitoring for entry point'),
  (1, 5, 220.00, 'Interesting if it drops');