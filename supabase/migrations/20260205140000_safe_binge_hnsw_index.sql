-- v4.9: Safe Binge HNSW Index Optimization
-- NOTE: Run via Supabase CLI or dashboard SQL editor to avoid timeout
-- HNSW indexes on large vector tables can take several minutes to build

-- Option 1: Partial index for Safe Binge queries only (smaller, faster)
CREATE INDEX IF NOT EXISTS idx_global_items_safe_binge
ON global_items 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE category_type = 'TV_SHOW' 
  AND status = 'Ended' 
  AND embedding IS NOT NULL;

-- Option 2: Replace IVFFlat TV_SHOW index with optimized HNSW (larger, more comprehensive)
-- Uncomment if you want to upgrade the general TV_SHOW vector index
/*
DROP INDEX IF EXISTS idx_global_items_embedding_tv_show;

CREATE INDEX idx_global_items_embedding_tv_show_hnsw
ON global_items 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE category_type = 'TV_SHOW' AND embedding IS NOT NULL;
*/

-- Index comments
COMMENT ON INDEX idx_global_items_safe_binge IS 'v4.9: Safe Binge query - Ended TV shows with HNSW vector search';
