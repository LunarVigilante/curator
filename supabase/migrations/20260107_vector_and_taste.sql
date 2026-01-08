-- ============================================================================
-- VECTOR SEARCH & TASTE COMPATIBILITY SETUP
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================================
-- ADD EMBEDDING COLUMN TO GLOBAL ITEMS
-- ⚠️ IMPORTANT: Vector dimension (1024) must match your embedding model!
-- voyage-3 (Voyage AI) = 1024, mistralai/mistral-embed = 1024
-- ============================================================================

ALTER TABLE public.global_items 
ADD COLUMN IF NOT EXISTS embedding extensions.vector(1024);

-- Add external_ids for storing provider IDs (tmdb, imdb, bgg, google_books, etc.)
ALTER TABLE public.global_items 
ADD COLUMN IF NOT EXISTS external_ids JSONB DEFAULT '{}';

-- Add metadata for additional item data
ALTER TABLE public.global_items 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_global_items_embedding 
ON public.global_items 
USING hnsw (embedding extensions.vector_cosine_ops);

-- Create GIN index for fast external_ids lookups
CREATE INDEX IF NOT EXISTS idx_global_items_external_ids 
ON public.global_items 
USING gin (external_ids);

-- ============================================================================
-- SEARCH ITEMS: Find similar items by embedding
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_items(
    query_embedding extensions.vector(1024),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    image_url TEXT,
    category_type TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.title,
        g.description,
        g.image_url,
        g.category_type,
        (1 - (g.embedding <=> query_embedding))::FLOAT AS similarity
    FROM global_items g
    WHERE g.embedding IS NOT NULL
      AND (category_filter IS NULL OR g.category_type = category_filter)
      AND (1 - (g.embedding <=> query_embedding)) > match_threshold
    ORDER BY g.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_items TO authenticated;

-- ============================================================================
-- SEARCH ITEMS BY VECTOR: Simplified search returning id, title, posterUrl
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_items_by_vector(
    query_embedding extensions.vector(1024),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    "posterUrl" TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.title,
        g.image_url AS "posterUrl",
        (1 - (g.embedding <=> query_embedding))::FLOAT AS similarity
    FROM global_items g
    WHERE g.embedding IS NOT NULL
      AND (1 - (g.embedding <=> query_embedding)) > match_threshold
    ORDER BY g.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_items_by_vector TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_items_by_vector TO anon;

-- ============================================================================
-- TASTE COMPATIBILITY: Hybrid ELO + Vector similarity
-- Returns 0-100 (percentage) or -1 if insufficient data (< 5 shared items)
-- Uses embeddings for semantic similarity when available
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_taste_compatibility(
    user_a_id UUID, 
    user_b_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    shared_count INTEGER;
    elo_distance FLOAT := 0;
    vector_similarity FLOAT := 0;
    vector_count INTEGER := 0;
    max_elo_distance FLOAT;
    elo_score FLOAT;
    vec_score FLOAT;
    final_score INTEGER;
BEGIN
    -- Create temp table with shared items (matched by global_item_id)
    CREATE TEMP TABLE temp_shared ON COMMIT DROP AS
    SELECT 
        a.global_item_id,
        a.elo_score AS elo_a,
        b.elo_score AS elo_b,
        ga.embedding AS embedding_a,
        gb.embedding AS embedding_b
    FROM items a
    INNER JOIN items b ON a.global_item_id = b.global_item_id
    LEFT JOIN global_items ga ON a.global_item_id = ga.id
    LEFT JOIN global_items gb ON b.global_item_id = gb.id
    WHERE a.user_id = user_a_id
      AND b.user_id = user_b_id
      AND a.global_item_id IS NOT NULL
      AND a.elo_score IS NOT NULL
      AND b.elo_score IS NOT NULL;
    
    -- Count shared items
    SELECT COUNT(*) INTO shared_count FROM temp_shared;
    
    -- Require minimum 5 shared items
    IF shared_count < 5 THEN
        RETURN -1;
    END IF;
    
    -- Calculate ELO-based distance (traditional method)
    SELECT COALESCE(SUM(ABS(elo_a - elo_b)), 0) 
    INTO elo_distance 
    FROM temp_shared;
    
    max_elo_distance := shared_count * 800.0;
    elo_score := (1.0 - (elo_distance / max_elo_distance)) * 100;
    
    -- Calculate vector similarity if embeddings available
    SELECT 
        COUNT(*),
        AVG(1 - (embedding_a <=> embedding_b)) * 100
    INTO vector_count, vector_similarity
    FROM temp_shared
    WHERE embedding_a IS NOT NULL AND embedding_b IS NOT NULL;
    
    -- Combine scores: weight vector similarity higher when available
    IF vector_count >= 3 THEN
        -- Hybrid: 60% vector similarity, 40% ELO
        final_score := ROUND((vector_similarity * 0.6) + (elo_score * 0.4))::INTEGER;
    ELSE
        -- Fallback: 100% ELO
        final_score := ROUND(elo_score)::INTEGER;
    END IF;
    
    -- Clamp to 0-100
    RETURN GREATEST(0, LEAST(100, final_score));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_taste_compatibility(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_taste_compatibility(UUID, UUID) TO anon;
