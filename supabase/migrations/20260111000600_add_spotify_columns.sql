-- Add Spotify specific columns to global_items

-- Artist Specifics
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS followers INTEGER;

-- Album Specifics
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS album_type TEXT; -- 'album', 'single', 'compilation'
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS total_tracks INTEGER;
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS upc TEXT;

-- Track/Audio Specifics
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS audio_features JSONB; -- { "danceability": 0.8, ... }
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS isrc TEXT;
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS album_name TEXT;
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS artist_names TEXT[];
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- Ensure indexes for frequent lookups
CREATE INDEX IF NOT EXISTS idx_global_items_isrc ON global_items(isrc);
CREATE INDEX IF NOT EXISTS idx_global_items_upc ON global_items(upc);
