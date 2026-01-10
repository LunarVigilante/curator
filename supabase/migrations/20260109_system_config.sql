-- System Configuration Table
-- Used for storing runtime configuration and API keys that can be managed via Admin UI

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    is_secret BOOLEAN DEFAULT FALSE, -- Hints to UI to mask the value
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial placeholder for SteamGridDB if needed (optional)
-- INSERT INTO system_config (key, value, description, is_secret)
-- VALUES ('STEAMGRIDDB_API_KEY', '', 'API Key for SteamGridDB Cover Art', TRUE)
-- ON CONFLICT DO NOTHING;
