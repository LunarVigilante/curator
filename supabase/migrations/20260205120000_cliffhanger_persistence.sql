-- =============================================================================
-- v4.5: Cliffhanger Persistence
-- Stores cliffhanger detection results for UI display and search
-- =============================================================================

-- Add cliffhanger tier and score columns to global_items
ALTER TABLE global_items
ADD COLUMN IF NOT EXISTS cliffhanger_tier TEXT,
ADD COLUMN IF NOT EXISTS cliffhanger_score FLOAT;

-- Add check constraint for valid tier values
ALTER TABLE global_items
ADD CONSTRAINT global_items_cliffhanger_tier_check
CHECK (cliffhanger_tier IS NULL OR cliffhanger_tier IN ('mechanical', 'structural', 'narrative', 'unaired_sequel', 'none'));

-- Add index for cliffhanger searches (e.g., "Show me all cliffhangers")
CREATE INDEX IF NOT EXISTS idx_global_items_cliffhanger_tier
ON global_items (cliffhanger_tier)
WHERE cliffhanger_tier IS NOT NULL AND cliffhanger_tier != 'none';

-- Add index for sorting by narrative completeness
CREATE INDEX IF NOT EXISTS idx_global_items_cliffhanger_score
ON global_items (cliffhanger_score DESC)
WHERE cliffhanger_score IS NOT NULL AND cliffhanger_score > 0;

-- Comment for documentation
COMMENT ON COLUMN global_items.cliffhanger_tier IS 'Cliffhanger detection tier: mechanical (0.9), structural (0.7), narrative (0.5), unaired_sequel (1.0), or none';
COMMENT ON COLUMN global_items.cliffhanger_score IS 'Cliffhanger confidence score (0.0-1.0). Higher = more likely unresolved ending.';
