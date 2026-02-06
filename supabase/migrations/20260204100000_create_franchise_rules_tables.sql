-- ============================================================================
-- FRANCHISE RULES & REVIEW QUEUE TABLES
-- Migration: Database-Driven Franchise Detection
-- ============================================================================
-- 
-- Replace hardcoded UNIVERSE_KEYWORD_MAP and KNOWN_SPINOFFS with database tables.
-- This allows adding new universes without code changes.
-- 
-- Tables:
-- 1. franchise_rules - Keyword-to-universe mappings
-- 2. franchise_review_queue - Suspected connections for human review
-- ============================================================================

-- =============================================================================
-- TABLE: franchise_rules
-- Replace hardcoded constants with database lookups
-- =============================================================================

CREATE TABLE IF NOT EXISTS franchise_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Rule type: what triggers this rule
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'keyword',      -- TMDB keyword ID triggers universe assignment
        'spinoff',      -- Show is known spinoff of another show
        'official_list' -- TVDB official list triggers universe assignment
    )),
    
    -- Source identifier (depends on rule_type)
    -- keyword: TMDB keyword name (e.g., "arrowverse")
    -- spinoff: TMDB show ID of the parent show
    -- official_list: TVDB official list name pattern
    source_identifier TEXT NOT NULL,
    
    -- Target universe slug (must exist in tv_universes)
    target_universe_slug TEXT NOT NULL,
    
    -- Confidence score (0-1)
    -- Used for probabilistic matching and review thresholds
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by rule type and source
CREATE INDEX IF NOT EXISTS idx_franchise_rules_lookup 
    ON franchise_rules(rule_type, lower(source_identifier));

-- Index for universe slug lookups
CREATE INDEX IF NOT EXISTS idx_franchise_rules_universe 
    ON franchise_rules(target_universe_slug);

-- =============================================================================
-- TABLE: franchise_review_queue
-- Suspected connections detected by MediaGraph BFS for human review
-- =============================================================================

CREATE TABLE IF NOT EXISTS franchise_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- The two shows with suspected connection
    show_a_id UUID REFERENCES global_items(id) ON DELETE CASCADE,
    show_b_id UUID REFERENCES global_items(id) ON DELETE CASCADE,
    
    -- Overlap metrics
    overlap_score FLOAT NOT NULL CHECK (overlap_score >= 0 AND overlap_score <= 1),
    overlap_reason TEXT, -- Human-readable reason: "75% shared producers", "Same creator"
    
    -- Detected connection details (JSON for flexibility)
    detection_details JSONB DEFAULT '{}',
    
    -- Review status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',   -- Awaiting human review
        'approved',  -- Confirmed connection - promote to franchise_rules
        'rejected',  -- False positive - no connection
        'deferred'   -- Needs more investigation
    )),
    
    -- Human reviewer fields
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate entries (both directions)
    UNIQUE (show_a_id, show_b_id),
    CHECK (show_a_id < show_b_id) -- Canonical ordering
);

-- Index for pending reviews
CREATE INDEX IF NOT EXISTS idx_franchise_review_pending 
    ON franchise_review_queue(status) WHERE status = 'pending';

-- Index for high-confidence pending items
CREATE INDEX IF NOT EXISTS idx_franchise_review_score
    ON franchise_review_queue(overlap_score DESC) WHERE status = 'pending';

-- =============================================================================
-- SEED DATA: Migrate existing hardcoded constants
-- =============================================================================

-- Seed from UNIVERSE_KEYWORD_MAP (common universe keywords)
INSERT INTO franchise_rules (rule_type, source_identifier, target_universe_slug, confidence, notes)
VALUES
    -- Arrowverse
    ('keyword', 'arrowverse', 'arrowverse', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    ('keyword', 'dc extended universe', 'dceu', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    
    -- Star Trek
    ('keyword', 'star trek', 'star-trek', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    ('keyword', 'star trek: the next generation', 'star-trek', 0.9, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    
    -- Walking Dead
    ('keyword', 'the walking dead', 'walking-dead', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    
    -- Breaking Bad
    ('keyword', 'breaking bad', 'breaking-bad', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    ('keyword', 'breaking bad universe', 'breaking-bad', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    
    -- Game of Thrones
    ('keyword', 'game of thrones', 'game-of-thrones', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    ('keyword', 'a song of ice and fire', 'game-of-thrones', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    
    -- Yellowstone
    ('keyword', 'yellowstone', 'yellowstone-verse', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP'),
    
    -- Chicago franchise
    ('keyword', 'chicago franchise', 'chicago-verse', 1.0, 'Migrated from UNIVERSE_KEYWORD_MAP')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE franchise_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchise_review_queue ENABLE ROW LEVEL SECURITY;

-- franchise_rules: Public read, admin write
DROP POLICY IF EXISTS "franchise_rules_read_all" ON franchise_rules;
CREATE POLICY "franchise_rules_read_all" ON franchise_rules
    FOR SELECT USING (true);

-- franchise_review_queue: Public read for pending items, admin write
DROP POLICY IF EXISTS "franchise_review_queue_read" ON franchise_review_queue;
CREATE POLICY "franchise_review_queue_read" ON franchise_review_queue
    FOR SELECT USING (true);

-- =============================================================================
-- FUNCTION: Insert suspected connection (with canonical ordering)
-- =============================================================================

-- Drop old version (parameter names changed)
DROP FUNCTION IF EXISTS insert_suspected_connection(uuid, uuid, double precision, text, jsonb);

CREATE OR REPLACE FUNCTION insert_suspected_connection(
    p_show_a UUID,
    p_show_b UUID,
    p_score FLOAT,
    p_reason TEXT,
    p_detection_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    -- Ensure canonical ordering (A < B) to prevent A-B and B-A duplicates
    v_a UUID := LEAST(p_show_a, p_show_b);
    v_b UUID := GREATEST(p_show_a, p_show_b);
    v_id UUID;
BEGIN
    INSERT INTO franchise_review_queue (show_a_id, show_b_id, overlap_score, overlap_reason, detection_details)
    VALUES (v_a, v_b, p_score, p_reason, p_detection_details)
    ON CONFLICT (show_a_id, show_b_id)
    DO UPDATE SET
        -- Update to higher score if detected again
        overlap_score = GREATEST(franchise_review_queue.overlap_score, EXCLUDED.overlap_score),
        overlap_reason = COALESCE(EXCLUDED.overlap_reason, franchise_review_queue.overlap_reason),
        detection_details = franchise_review_queue.detection_details || EXCLUDED.detection_details,
        updated_at = NOW(),
        -- Don't revive rejected pairs - human said "no" so respect that
        status = CASE
            WHEN franchise_review_queue.status = 'rejected' THEN 'rejected'
            ELSE 'pending'
        END
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (for harvester)
GRANT EXECUTE ON FUNCTION insert_suspected_connection TO authenticated;
