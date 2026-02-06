-- ============================================================================
-- Franchise Links Table with v4.2 Provenance Tracking
-- ============================================================================
-- Applied via Supabase MCP on 2026-02-05

CREATE TABLE IF NOT EXISTS franchise_links (
    link_id BIGSERIAL PRIMARY KEY,
    source_show_id UUID NOT NULL REFERENCES global_items(id) ON DELETE CASCADE,
    target_show_id UUID NOT NULL REFERENCES global_items(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL CHECK (link_type IN ('spinoff', 'crossover', 'shared_universe', 'reboot', 'revival')),
    
    strength_score FLOAT DEFAULT 0.0 CHECK (strength_score >= 0.0 AND strength_score <= 1.0),
    confidence_score FLOAT DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    
    shared_attribute TEXT,
    tmdb_credit_id TEXT,
    
    -- v4.2 Provenance Tracking
    source_type TEXT CHECK (source_type IN ('auto_keyword', 'auto_credits', 'auto_wikidata', 'llm_inference', 'manual', 'cliffhanger_detection')),
    source_details JSONB DEFAULT '{}',
    
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT unique_link_pair UNIQUE (source_show_id, target_show_id),
    CONSTRAINT no_self_link CHECK (source_show_id != target_show_id)
);

-- Add v4.2 columns if table already existed
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchise_links' AND column_name = 'source_type') THEN
        ALTER TABLE franchise_links ADD COLUMN source_type TEXT 
            CHECK (source_type IN ('auto_keyword', 'auto_credits', 'auto_wikidata', 'llm_inference', 'manual', 'cliffhanger_detection'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchise_links' AND column_name = 'source_details') THEN
        ALTER TABLE franchise_links ADD COLUMN source_details JSONB DEFAULT '{}';
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_franchise_links_source ON franchise_links(source_show_id);
CREATE INDEX IF NOT EXISTS idx_franchise_links_target ON franchise_links(target_show_id);
CREATE INDEX IF NOT EXISTS idx_franchise_links_type ON franchise_links(link_type);
CREATE INDEX IF NOT EXISTS idx_franchise_links_verified ON franchise_links(verified) WHERE verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_franchise_links_source_type ON franchise_links(source_type);

-- Comments
COMMENT ON TABLE franchise_links IS 'Many-to-many junction for show relationships (crossovers, reboots, etc.)';
COMMENT ON COLUMN franchise_links.source_type IS 'How link was created: auto_keyword, auto_credits, auto_wikidata, llm_inference, manual, cliffhanger_detection';
COMMENT ON COLUMN franchise_links.source_details IS 'Structured metadata: { "keyword_id": 123, "person_name": "..." }';

-- RLS
ALTER TABLE franchise_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "franchise_links_read" ON franchise_links;
CREATE POLICY "franchise_links_read" ON franchise_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "franchise_links_insert_auth" ON franchise_links;
CREATE POLICY "franchise_links_insert_auth" ON franchise_links FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_franchise_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_franchise_links_updated_at ON franchise_links;
CREATE TRIGGER trigger_franchise_links_updated_at
    BEFORE UPDATE ON franchise_links
    FOR EACH ROW
    EXECUTE FUNCTION update_franchise_links_updated_at();
