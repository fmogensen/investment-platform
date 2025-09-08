-- API Configuration Management

-- API providers configuration
CREATE TABLE IF NOT EXISTS api_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  api_key TEXT,
  is_active BOOLEAN DEFAULT 1,
  is_default BOOLEAN DEFAULT 0,
  rate_limit INTEGER, -- requests per minute
  daily_limit INTEGER, -- requests per day
  last_used DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  response_time INTEGER, -- milliseconds
  status_code INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES api_providers(id)
);

-- Admin settings
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type TEXT CHECK(setting_type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default API providers
INSERT OR IGNORE INTO api_providers (name, display_name, rate_limit, daily_limit) VALUES 
  ('alpha_vantage', 'Alpha Vantage', 5, 500),
  ('finnhub', 'Finnhub', 60, 86400),
  ('twelve_data', 'Twelve Data', 8, 800),
  ('yahoo_finance', 'Yahoo Finance (RapidAPI)', 100, 10000),
  ('polygon', 'Polygon.io', 5, 1000),
  ('iex_cloud', 'IEX Cloud', 100, 50000);

-- Insert default admin settings
INSERT OR IGNORE INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES 
  ('enable_caching', 'true', 'boolean', 'Enable API response caching'),
  ('cache_duration', '60', 'number', 'Cache duration in seconds'),
  ('enable_fallback', 'true', 'boolean', 'Use fallback API if primary fails'),
  ('update_interval', '60', 'number', 'Price update interval in seconds'),
  ('max_retries', '3', 'number', 'Maximum API retry attempts');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage(provider_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_providers_active ON api_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);