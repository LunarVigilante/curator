-- ============================================================================
-- Full-Text Search (BM25) Support
-- ============================================================================

-- Add tsvector column for efficient keyword search
ALTER TABLE global_items 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Generate tsvector from title and description
-- This will be maintained by a trigger
CREATE OR REPLACE FUNCTION update_search_vector() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.title, '') || ' ' || 
        COALESCE(NEW.description, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector
DROP TRIGGER IF EXISTS trg_update_search_vector ON global_items;
CREATE TRIGGER trg_update_search_vector
    BEFORE INSERT OR UPDATE OF title, description ON global_items
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

-- NOTE: Backfill of existing rows is deferred to avoid timeout.
-- Run the backfill script manually: src/scripts/backfill-search-vector.ts

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_global_items_search_vector
    ON global_items USING gin(search_vector);

COMMENT ON COLUMN global_items.search_vector IS 
    'Precomputed tsvector for BM25 full-text search';

-- ============================================================================
-- Matryoshka 512d HNSW Index
-- 
-- Voyage-4 produces hierarchically-ordered 1024d vectors where the first
-- half (512 dimensions) contains ~95% of semantic information.
-- 
-- The 'embedding' column is already type vector(1024).
-- We create a partial index for faster retrieval at reduced cost.
-- ============================================================================

-- Note: pgvector does not directly support indexing sliced vectors,
-- so we index the full embedding but can query with truncated vectors.
-- The HNSW index on 'embedding' already exists.

-- ============================================================================
-- Hybrid Search RPC Function
-- ============================================================================

-- Create RPC function for hybrid search with RRF fusion
-- Uses the 'embedding' column (vector type) for similarity search
CREATE OR REPLACE FUNCTION hybrid_search_rrf(
    query_text TEXT,
    query_embedding VECTOR(1024),
    match_count INT DEFAULT 20,
    category_filter TEXT DEFAULT NULL,
    rrf_k INT DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    image_url TEXT,
    category_type TEXT,
    keyword_rank BIGINT,
    vector_rank BIGINT,
    rrf_score DOUBLE PRECISION
) AS $$
WITH 
-- Keyword Search (BM25-style full-text search)
keyword_results AS (
    SELECT 
        gi.id,
        gi.title,
        gi.description,
        gi.image_url,
        gi.category_type,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(gi.search_vector, websearch_to_tsquery('english', query_text)) DESC) as rank
    FROM global_items gi
    WHERE 
        gi.search_vector @@ websearch_to_tsquery('english', query_text)
        AND (category_filter IS NULL OR gi.category_type = category_filter)
    ORDER BY ts_rank_cd(gi.search_vector, websearch_to_tsquery('english', query_text)) DESC
    LIMIT match_count * 2
),
-- Vector Search (Semantic similarity via HNSW on embedding column)
vector_results AS (
    SELECT 
        gi.id,
        gi.title,
        gi.description,
        gi.image_url,
        gi.category_type,
        ROW_NUMBER() OVER (ORDER BY gi.embedding <=> query_embedding) as rank
    FROM global_items gi
    WHERE 
        gi.embedding IS NOT NULL
        AND (category_filter IS NULL OR gi.category_type = category_filter)
    ORDER BY gi.embedding <=> query_embedding
    LIMIT match_count * 2
),
-- Reciprocal Rank Fusion
fused AS (
    SELECT 
        COALESCE(k.id, v.id) as id,
        COALESCE(k.title, v.title) as title,
        COALESCE(k.description, v.description) as description,
        COALESCE(k.image_url, v.image_url) as image_url,
        COALESCE(k.category_type, v.category_type) as category_type,
        k.rank as keyword_rank,
        v.rank as vector_rank,
        COALESCE(1.0 / (rrf_k + k.rank), 0) + COALESCE(1.0 / (rrf_k + v.rank), 0) as rrf_score
    FROM keyword_results k
    FULL OUTER JOIN vector_results v ON k.id = v.id
)
SELECT 
    f.id,
    f.title,
    f.description,
    f.image_url,
    f.category_type,
    f.keyword_rank,
    f.vector_rank,
    f.rrf_score
FROM fused f
ORDER BY f.rrf_score DESC
LIMIT match_count;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION hybrid_search_rrf IS 
    'Performs hybrid search combining BM25 keyword search with vector similarity, fused via Reciprocal Rank Fusion';
