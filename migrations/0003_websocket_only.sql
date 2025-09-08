-- Remove non-WebSocket API providers

-- Delete usage data for non-WebSocket providers
DELETE FROM api_usage 
WHERE provider_id IN (
  SELECT id FROM api_providers 
  WHERE name NOT IN ('finnhub', 'twelve_data')
);

-- Delete non-WebSocket providers
DELETE FROM api_providers 
WHERE name NOT IN ('finnhub', 'twelve_data');

-- Update display names and info for WebSocket providers
UPDATE api_providers 
SET display_name = 'Finnhub (WebSocket)', 
    rate_limit = 60,
    daily_limit = NULL
WHERE name = 'finnhub';

UPDATE api_providers 
SET display_name = 'Twelve Data (WebSocket)', 
    rate_limit = 8,
    daily_limit = 800
WHERE name = 'twelve_data';

-- Add WebSocket support column
ALTER TABLE api_providers ADD COLUMN websocket_supported BOOLEAN DEFAULT 0;

-- Mark WebSocket providers
UPDATE api_providers SET websocket_supported = 1 
WHERE name IN ('finnhub', 'twelve_data');

-- Ensure we have the WebSocket providers
INSERT OR IGNORE INTO api_providers (name, display_name, rate_limit, daily_limit, websocket_supported) VALUES 
  ('finnhub', 'Finnhub (WebSocket)', 60, NULL, 1),
  ('twelve_data', 'Twelve Data (WebSocket)', 8, 800, 1);