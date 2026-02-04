-- ============================================================================
-- Franchise Type and Semantic Hash Columns
-- Supports Save the Cat methodology and change detection
-- ============================================================================

-- Franchise Type (Save the Cat - 8 franchise types)
-- Values: MONSTER_IN_THE_HOUSE, GOLDEN_FLEECE, OUT_OF_THE_BOTTLE, 
--         DUDE_WITH_A_PROBLEM, RITES_OF_PASSAGE, BUDDY_LOVE, 
--         WHYDUNIT, FOOL_TRIUMPHANT, UNKNOWN
ALTER TABLE global_items 
ADD COLUMN IF NOT EXISTS franchise_type TEXT;

COMMENT ON COLUMN global_items.franchise_type IS 
    'Save the Cat franchise type - identifies the narrative engine of a TV show';

-- Semantic Hash (for change detection during rehydration)
-- SHA-256 hash of semantic fields (title + overview + cast + genres)
-- Compare hashes to avoid unnecessary re-embedding
ALTER TABLE global_items 
ADD COLUMN IF NOT EXISTS semantic_hash TEXT;

COMMENT ON COLUMN global_items.semantic_hash IS 
    'SHA-256 hash of semantic fields for change detection during rehydration';

-- Pilot Beats (for high-value shows - Save the Cat beat sheet)
-- JSON structure: { catalyst, breakIntoTwo, midpoint, allIsLost, finalImage }
ALTER TABLE global_items 
ADD COLUMN IF NOT EXISTS pilot_beats JSONB;

COMMENT ON COLUMN global_items.pilot_beats IS 
    'Save the Cat pilot beat sheet for high-value TV shows';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for franchise type filtering
CREATE INDEX IF NOT EXISTS idx_global_items_franchise_type
    ON global_items (franchise_type)
    WHERE franchise_type IS NOT NULL;

-- Composite index for narrative queries
-- Combines franchise + bucket for efficient "shows like X" queries
CREATE INDEX IF NOT EXISTS idx_global_items_narrative_classification
    ON global_items (franchise_type, bucket_type, format_type)
    WHERE franchise_type IS NOT NULL AND bucket_type IS NOT NULL;
