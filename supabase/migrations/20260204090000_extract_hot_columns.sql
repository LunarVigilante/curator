-- ============================================================================
-- HOT COLUMNS EXTRACTION: Performance Optimization
-- Extract frequently queried fields from JSONB to indexed columns
-- ============================================================================

-- Add "hot" columns for high-frequency filters
ALTER TABLE global_items 
    ADD COLUMN IF NOT EXISTS original_language TEXT,
    ADD COLUMN IF NOT EXISTS production_status TEXT,  -- "Returning Series", "Ended", "Canceled", etc.
    ADD COLUMN IF NOT EXISTS network TEXT,            -- Primary network name
    ADD COLUMN IF NOT EXISTS seasons_count INTEGER,
    ADD COLUMN IF NOT EXISTS episodes_count INTEGER,
    ADD COLUMN IF NOT EXISTS episode_runtime INTEGER, -- Average episode runtime in minutes
    ADD COLUMN IF NOT EXISTS first_air_date DATE,     -- More precise than release_year
    ADD COLUMN IF NOT EXISTS last_air_date DATE,      -- For ongoing series tracking
    ADD COLUMN IF NOT EXISTS in_production BOOLEAN DEFAULT FALSE;

-- Add column comments
COMMENT ON COLUMN global_items.original_language IS 'ISO 639-1 language code (e.g., "en", "ko", "ja")';
COMMENT ON COLUMN global_items.production_status IS 'TMDB status: Returning Series, Ended, Canceled, In Production, Planned';
COMMENT ON COLUMN global_items.network IS 'Primary broadcast/streaming network';
COMMENT ON COLUMN global_items.seasons_count IS 'Total number of seasons';
COMMENT ON COLUMN global_items.episodes_count IS 'Total number of episodes';
COMMENT ON COLUMN global_items.first_air_date IS 'Series premiere date';
COMMENT ON COLUMN global_items.last_air_date IS 'Most recent episode air date (updated during rehydrate)';
COMMENT ON COLUMN global_items.in_production IS 'Whether the series is currently in production';

-- ============================================================================
-- MIGRATE DATA FROM METADATA JSONB
-- ============================================================================

-- TV Shows
UPDATE global_items
SET 
    original_language = metadata->>'original_language',
    production_status = metadata->>'status',
    network = metadata->'networks'->0->>'name',
    seasons_count = (metadata->>'number_of_seasons')::INTEGER,
    episodes_count = (metadata->>'number_of_episodes')::INTEGER,
    episode_runtime = (
        SELECT (jsonb_array_elements_text(metadata->'episode_run_time')::INTEGER)
        LIMIT 1
    ),
    first_air_date = (metadata->>'first_air_date')::DATE,
    last_air_date = (metadata->>'last_air_date')::DATE,
    in_production = (metadata->>'in_production')::BOOLEAN
WHERE category_type = 'TV_SHOW'
  AND metadata IS NOT NULL;

-- Movies (partial - some fields apply)
UPDATE global_items
SET 
    original_language = metadata->>'original_language',
    production_status = metadata->>'status'
WHERE category_type = 'MOVIE'
  AND metadata IS NOT NULL
  AND original_language IS NULL;

-- ============================================================================
-- CREATE INDEXES FOR HOT COLUMNS
-- ============================================================================

-- Primary filter columns
CREATE INDEX IF NOT EXISTS idx_gi_original_language 
    ON global_items(original_language) 
    WHERE original_language IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gi_production_status 
    ON global_items(production_status) 
    WHERE production_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gi_network 
    ON global_items(network) 
    WHERE network IS NOT NULL;

-- Numeric range filters
CREATE INDEX IF NOT EXISTS idx_gi_seasons_count 
    ON global_items(seasons_count) 
    WHERE seasons_count IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gi_episodes_count 
    ON global_items(episodes_count) 
    WHERE episodes_count IS NOT NULL;

-- Date range filters
CREATE INDEX IF NOT EXISTS idx_gi_first_air_date 
    ON global_items(first_air_date) 
    WHERE first_air_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gi_last_air_date 
    ON global_items(last_air_date) 
    WHERE last_air_date IS NOT NULL;

-- Composite index for common filter patterns
CREATE INDEX IF NOT EXISTS idx_gi_tv_filters 
    ON global_items(category_type, production_status, original_language) 
    WHERE category_type = 'TV_SHOW';

-- In-production filter for "what to watch next" queries
CREATE INDEX IF NOT EXISTS idx_gi_in_production 
    ON global_items(in_production) 
    WHERE in_production = TRUE;
