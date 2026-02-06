-- ============================================================================
-- Franchise Links Junction Table
-- ============================================================================
-- Enables many-to-many relationships between shows for crossovers, reboots,
-- revivals, and other complex franchise connections.

CREATE TABLE IF NOT EXISTS franchise_links (
    link_id BIGSERIAL PRIMARY KEY,
    source_show_id UUID NOT NULL REFERENCES global_items(id) ON DELETE CASCADE,
    target_show_id UUID NOT NULL REFERENCES global_items(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL CHECK (link_type IN ('spinoff', 'crossover', 'shared_universe', 'reboot', 'revival')),
    
    -- Graph Weights & AI Confidence
    strength_score FLOAT DEFAULT 0.0 CHECK (strength_score >= 0.0 AND strength_score <= 1.0),
    confidence_score FLOAT DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    
    -- Discovery metadata
    shared_attribute TEXT,  -- 'keyword', 'creator', 'production_company'
    tmdb_credit_id TEXT,    -- ID of shared person if discovered via credits
    
    -- Verification status
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Prevent duplicate links (A->B only, not both A->B and B->A)
    CONSTRAINT unique_link_pair UNIQUE (source_show_id, target_show_id),
    -- Prevent self-referential links
    CONSTRAINT no_self_link CHECK (source_show_id != target_show_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- For traversing the graph from either direction
CREATE INDEX IF NOT EXISTS idx_franchise_links_source ON franchise_links(source_show_id);
CREATE INDEX IF NOT EXISTS idx_franchise_links_target ON franchise_links(target_show_id);

-- For filtering by link type
CREATE INDEX IF NOT EXISTS idx_franchise_links_type ON franchise_links(link_type);

-- For finding verified links
CREATE INDEX IF NOT EXISTS idx_franchise_links_verified ON franchise_links(verified) WHERE verified = TRUE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE franchise_links IS 
    'Many-to-many junction table for complex show relationships (crossovers, reboots, etc.)';

COMMENT ON COLUMN franchise_links.link_type IS 
    'Relationship type: spinoff, crossover, shared_universe, reboot, revival';

COMMENT ON COLUMN franchise_links.strength_score IS 
    'Graph edge weight 0.0-1.0: higher = stronger creative connection';

COMMENT ON COLUMN franchise_links.confidence_score IS 
    'AI classification confidence 0.0-1.0: used for auto-verification threshold';

COMMENT ON COLUMN franchise_links.shared_attribute IS 
    'Discovery source: keyword, creator, or production_company';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE franchise_links ENABLE ROW LEVEL SECURITY;

-- Anyone can read franchise links (public metadata)
CREATE POLICY "Anyone can read franchise links" 
    ON franchise_links FOR SELECT 
    USING (true);

-- Admins can manage franchise links
CREATE POLICY "Admins can manage franchise links" 
    ON franchise_links FOR ALL 
    USING (public.is_admin());

-- Authenticated users can propose links (inserted unverified)
CREATE POLICY "Authenticated can insert unverified links" 
    ON franchise_links FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated' AND verified = FALSE);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_franchise_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_franchise_links_updated_at
    BEFORE UPDATE ON franchise_links
    FOR EACH ROW
    EXECUTE FUNCTION update_franchise_links_updated_at();
