-- Enhanced similar items function that returns shared genres/tags
-- This provides context for WHY items are similar

CREATE OR REPLACE FUNCTION public.find_similar_items_with_reasons(
    source_item_id uuid,
    match_count int DEFAULT 10,
    category_filter text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    image_url text,
    category_type text,
    similarity float,
    shared_genres text[],
    shared_tags text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    source_embedding vector(1024);
    source_genres text[];
    source_tags text[];
BEGIN
    -- Get source item's embedding, genres, and tags
    SELECT 
        gi.embedding,
        gi.genres,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(gi.cached_tags, '[]'::jsonb)))
    INTO source_embedding, source_genres, source_tags
    FROM public.global_items gi
    WHERE gi.id = source_item_id;

    IF source_embedding IS NULL THEN
        RETURN; 
    END IF;

    RETURN QUERY
    SELECT
        gi.id,
        gi.title,
        gi.image_url,
        gi.category_type,
        (1 - (gi.embedding <=> source_embedding))::float as similarity,
        -- Find intersection of genres
        ARRAY(
            SELECT unnest(COALESCE(gi.genres, ARRAY[]::text[]))
            INTERSECT
            SELECT unnest(COALESCE(source_genres, ARRAY[]::text[]))
        ) as shared_genres,
        -- Find intersection of tags
        ARRAY(
            SELECT jsonb_array_elements_text(COALESCE(gi.cached_tags, '[]'::jsonb))
            INTERSECT
            SELECT unnest(COALESCE(source_tags, ARRAY[]::text[]))
        ) as shared_tags
    FROM public.global_items gi
    WHERE
        gi.embedding IS NOT NULL
        AND gi.id != source_item_id
        AND (category_filter IS NULL OR gi.category_type = category_filter)
    ORDER BY gi.embedding <=> source_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_items_with_reasons TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_similar_items_with_reasons TO anon;
