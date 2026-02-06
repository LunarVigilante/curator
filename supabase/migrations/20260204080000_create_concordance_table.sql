-- ============================================================================
-- CONCORDANCE TABLE: Golden Record ID Mapping
-- Maps internal UUIDs to external provider IDs for identity stability
-- ============================================================================

-- Create concordance table for cross-provider ID mapping
CREATE TABLE IF NOT EXISTS id_concordance (
    -- Internal UUID is the primary key (Golden Record)
    internal_id UUID PRIMARY KEY REFERENCES global_items(id) ON DELETE CASCADE,
    
    -- External provider IDs
    tmdb_id INTEGER,           -- TMDB numeric ID
    imdb_id TEXT,              -- IMDb ID (e.g., "tt1234567")
    tvdb_id INTEGER,           -- TVDB numeric ID
    wikidata_id TEXT,          -- Wikidata Q-ID (e.g., "Q12345")
    eidr_id TEXT,              -- EIDR ID (future)
    gracenote_id TEXT,         -- Gracenote TMS ID (future)
    
    -- Wikidata federation results (cached)
    wikidata_series TEXT,      -- P179: "part of the series" Q-ID
    wikidata_universe TEXT,    -- P140: "narrative universe" Q-ID
    wikidata_based_on TEXT,    -- P144: "based on" Q-ID
    wikidata_spinoff_of TEXT,  -- P8345: "spinoff of" Q-ID
    
    -- Audit fields
    last_verified TIMESTAMPTZ DEFAULT now(),
    last_wikidata_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraints on external IDs (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_concordance_tmdb ON id_concordance(tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_concordance_imdb ON id_concordance(imdb_id) WHERE imdb_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_concordance_wikidata ON id_concordance(wikidata_id) WHERE wikidata_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_concordance_tvdb ON id_concordance(tvdb_id) WHERE tvdb_id IS NOT NULL;

-- Index for reverse lookups
CREATE INDEX IF NOT EXISTS idx_concordance_series ON id_concordance(wikidata_series) WHERE wikidata_series IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_concordance_universe ON id_concordance(wikidata_universe) WHERE wikidata_universe IS NOT NULL;

-- Add table comment
COMMENT ON TABLE id_concordance IS 'Golden Record concordance table mapping internal UUIDs to external provider IDs (TMDB, IMDb, Wikidata, etc.)';
COMMENT ON COLUMN id_concordance.internal_id IS 'Primary internal UUID - the stable identity for this item';
COMMENT ON COLUMN id_concordance.wikidata_series IS 'Wikidata P179 "part of the series" - e.g., Game of Thrones is part of ASOIAF';
COMMENT ON COLUMN id_concordance.wikidata_universe IS 'Wikidata P140 "narrative universe" - e.g., Flash is part of Arrowverse';

-- ============================================================================
-- MIGRATE DATA FROM EXISTING external_ids JSONB
-- ============================================================================

INSERT INTO id_concordance (
    internal_id,
    tmdb_id,
    imdb_id,
    tvdb_id,
    wikidata_id,
    created_at
)
SELECT 
    id as internal_id,
    (external_ids->>'tmdb')::INTEGER as tmdb_id,
    external_ids->>'imdb' as imdb_id,
    (external_ids->>'tvdb')::INTEGER as tvdb_id,
    external_ids->>'wikidata' as wikidata_id,
    created_at
FROM global_items
WHERE external_ids IS NOT NULL 
  AND external_ids != '{}'::JSONB
ON CONFLICT (internal_id) DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE id_concordance ENABLE ROW LEVEL SECURITY;

-- Public read access (concordance is non-sensitive metadata)
CREATE POLICY "Public read access to concordance"
    ON id_concordance FOR SELECT
    USING (true);

-- Only service role can write
CREATE POLICY "Service role write access to concordance"
    ON id_concordance FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================================

CREATE TRIGGER update_concordance_updated_at
    BEFORE UPDATE ON id_concordance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
