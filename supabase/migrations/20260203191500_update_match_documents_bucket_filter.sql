-- Update match_documents RPC with bucket_filter parameter for hard partitioning
-- This enables pre-filtering by bucket_type (NARRATIVE, FORMAT, OBSERVATIONAL)
-- before vector similarity search, preventing cross-bucket false positives

-- Ensure vector extension is available
SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding extensions.vector(1024),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 20,
    category_filter text DEFAULT NULL,
    bucket_filter text[] DEFAULT NULL  -- NEW: Hard partition by bucket type
)
RETURNS TABLE (
    id uuid,
    title text,
    image_url text,
    category_type text,
    description text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gi.id,
        gi.title,
        gi.image_url,
        gi.category_type,
        gi.description,
        (1 - (gi.embedding <=> query_embedding))::float as similarity
    FROM public.global_items gi
    WHERE 
        gi.embedding IS NOT NULL
        AND (category_filter IS NULL OR gi.category_type = category_filter)
        -- Hard partition filter: Pre-filter by bucket_type BEFORE vector similarity
        AND (bucket_filter IS NULL OR gi.bucket_type = ANY(bucket_filter))
        AND (1 - (gi.embedding <=> query_embedding)) > match_threshold
    ORDER BY gi.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute to authenticated users (with full signature for disambiguation)
GRANT EXECUTE ON FUNCTION public.match_documents(extensions.vector(1024), float, int, text, text[]) TO authenticated;
