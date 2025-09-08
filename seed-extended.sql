-- Extended seed data for better demo experience

-- Insert more popular stocks
INSERT OR IGNORE INTO securities (symbol, name, type, exchange, currency, sector, industry, last_price) VALUES 
  -- Tech Giants
  ('AMD', 'Advanced Micro Devices Inc.', 'stock', 'NASDAQ', 'USD', 'Technology', 'Semiconductors', 168.92),
  ('INTC', 'Intel Corporation', 'stock', 'NASDAQ', 'USD', 'Technology', 'Semiconductors', 45.67),
  ('CRM', 'Salesforce Inc.', 'stock', 'NYSE', 'USD', 'Technology', 'Software', 267.84),
  ('ORCL', 'Oracle Corporation', 'stock', 'NYSE', 'USD', 'Technology', 'Software', 115.23),
  ('ADBE', 'Adobe Inc.', 'stock', 'NASDAQ', 'USD', 'Technology', 'Software', 598.71),
  ('NFLX', 'Netflix Inc.', 'stock', 'NASDAQ', 'USD', 'Technology', 'Entertainment', 486.93),
  ('UBER', 'Uber Technologies Inc.', 'stock', 'NYSE', 'USD', 'Technology', 'Transportation', 62.14),
  ('SHOP', 'Shopify Inc.', 'stock', 'NYSE', 'USD', 'Technology', 'E-Commerce', 78.45),
  ('SQ', 'Block Inc.', 'stock', 'NYSE', 'USD', 'Technology', 'Payments', 71.89),
  ('PYPL', 'PayPal Holdings Inc.', 'stock', 'NASDAQ', 'USD', 'Technology', 'Payments', 63.42),
  
  -- Finance
  ('BAC', 'Bank of America Corp.', 'stock', 'NYSE', 'USD', 'Financial', 'Banking', 34.78),
  ('WFC', 'Wells Fargo & Co.', 'stock', 'NYSE', 'USD', 'Financial', 'Banking', 46.92),
  ('GS', 'Goldman Sachs Group Inc.', 'stock', 'NYSE', 'USD', 'Financial', 'Investment Banking', 387.54),
  ('MS', 'Morgan Stanley', 'stock', 'NYSE', 'USD', 'Financial', 'Investment Banking', 97.82),
  ('AXP', 'American Express Co.', 'stock', 'NYSE', 'USD', 'Financial', 'Credit Services', 178.93),
  ('MA', 'Mastercard Inc.', 'stock', 'NYSE', 'USD', 'Financial', 'Payment Services', 432.65),
  ('C', 'Citigroup Inc.', 'stock', 'NYSE', 'USD', 'Financial', 'Banking', 58.74),
  
  -- Healthcare
  ('JNJ', 'Johnson & Johnson', 'stock', 'NYSE', 'USD', 'Healthcare', 'Pharmaceuticals', 158.42),
  ('PFE', 'Pfizer Inc.', 'stock', 'NYSE', 'USD', 'Healthcare', 'Pharmaceuticals', 31.28),
  ('UNH', 'UnitedHealth Group Inc.', 'stock', 'NYSE', 'USD', 'Healthcare', 'Health Insurance', 524.87),
  ('CVS', 'CVS Health Corp.', 'stock', 'NYSE', 'USD', 'Healthcare', 'Healthcare Services', 71.34),
  ('ABBV', 'AbbVie Inc.', 'stock', 'NYSE', 'USD', 'Healthcare', 'Pharmaceuticals', 157.89),
  ('MRK', 'Merck & Co. Inc.', 'stock', 'NYSE', 'USD', 'Healthcare', 'Pharmaceuticals', 109.23),
  ('LLY', 'Eli Lilly and Co.', 'stock', 'NYSE', 'USD', 'Healthcare', 'Pharmaceuticals', 589.76),
  
  -- Consumer
  ('DIS', 'Walt Disney Co.', 'stock', 'NYSE', 'USD', 'Consumer Cyclical', 'Entertainment', 92.37),
  ('NKE', 'Nike Inc.', 'stock', 'NYSE', 'USD', 'Consumer Cyclical', 'Apparel', 107.84),
  ('SBUX', 'Starbucks Corp.', 'stock', 'NASDAQ', 'USD', 'Consumer Cyclical', 'Restaurants', 95.62),
  ('MCD', 'McDonald''s Corp.', 'stock', 'NYSE', 'USD', 'Consumer Cyclical', 'Restaurants', 283.91),
  ('HD', 'Home Depot Inc.', 'stock', 'NYSE', 'USD', 'Consumer Cyclical', 'Retail', 367.42),
  ('WMT', 'Walmart Inc.', 'stock', 'NYSE', 'USD', 'Consumer Defensive', 'Retail', 164.78),
  ('TGT', 'Target Corp.', 'stock', 'NYSE', 'USD', 'Consumer Defensive', 'Retail', 152.34),
  ('COST', 'Costco Wholesale Corp.', 'stock', 'NASDAQ', 'USD', 'Consumer Defensive', 'Retail', 678.93),
  ('PG', 'Procter & Gamble Co.', 'stock', 'NYSE', 'USD', 'Consumer Defensive', 'Consumer Goods', 147.82),
  ('KO', 'Coca-Cola Co.', 'stock', 'NYSE', 'USD', 'Consumer Defensive', 'Beverages', 59.87),
  ('PEP', 'PepsiCo Inc.', 'stock', 'NASDAQ', 'USD', 'Consumer Defensive', 'Beverages', 171.23),
  
  -- Energy
  ('XOM', 'Exxon Mobil Corp.', 'stock', 'NYSE', 'USD', 'Energy', 'Oil & Gas', 104.56),
  ('CVX', 'Chevron Corp.', 'stock', 'NYSE', 'USD', 'Energy', 'Oil & Gas', 147.89),
  
  -- More ETFs
  ('ARKK', 'ARK Innovation ETF', 'etf', 'NYSE', 'USD', 'Technology', 'Innovation', 42.78),
  ('DIA', 'SPDR Dow Jones Industrial Average ETF', 'etf', 'NYSE', 'USD', 'Broad Market', 'Large Cap', 378.45),
  ('IVV', 'iShares Core S&P 500 ETF', 'etf', 'NYSE', 'USD', 'Broad Market', 'Large Cap', 452.89),
  ('VIG', 'Vanguard Dividend Appreciation ETF', 'etf', 'NYSE', 'USD', 'Dividend', 'Large Cap', 167.34),
  ('VYM', 'Vanguard High Dividend Yield ETF', 'etf', 'NYSE', 'USD', 'Dividend', 'High Yield', 112.45),
  ('AGG', 'iShares Core U.S. Aggregate Bond ETF', 'etf', 'NYSE', 'USD', 'Bonds', 'Aggregate', 101.23),
  ('TLT', 'iShares 20+ Year Treasury Bond ETF', 'etf', 'NASDAQ', 'USD', 'Bonds', 'Treasury', 93.67),
  ('GLD', 'SPDR Gold Shares', 'etf', 'NYSE', 'USD', 'Commodities', 'Gold', 182.34),
  ('SLV', 'iShares Silver Trust', 'etf', 'NYSE', 'USD', 'Commodities', 'Silver', 21.45),
  ('XLE', 'Energy Select Sector SPDR Fund', 'etf', 'NYSE', 'USD', 'Energy', 'Sector', 87.92),
  ('XLF', 'Financial Select Sector SPDR Fund', 'etf', 'NYSE', 'USD', 'Financial', 'Sector', 38.45),
  ('XLK', 'Technology Select Sector SPDR Fund', 'etf', 'NYSE', 'USD', 'Technology', 'Sector', 178.93),
  ('XLV', 'Health Care Select Sector SPDR Fund', 'etf', 'NYSE', 'USD', 'Healthcare', 'Sector', 132.78),
  ('VNQ', 'Vanguard Real Estate ETF', 'etf', 'NYSE', 'USD', 'Real Estate', 'REITs', 84.56),
  ('EEM', 'iShares MSCI Emerging Markets ETF', 'etf', 'NYSE', 'USD', 'International', 'Emerging Markets', 39.87),
  ('EFA', 'iShares MSCI EAFE ETF', 'etf', 'NYSE', 'USD', 'International', 'Developed Markets', 73.45);