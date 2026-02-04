-- Fix similar items function to default to same category as source item
-- when no explicit category filter is provided.
-- This prevents cross-category matches (e.g., movies matching video games)

-- Drop existing function first since return type is changing
DROP FUNCTION IF EXISTS public.find_similar_items_with_reasons(uuid, integer, text);

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
    release_year int,
    runtime int,
    vote_average float,
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
    source_category text;
    effective_category_filter text;
BEGIN
    -- Get source item's embedding, genres, tags, and category
    SELECT 
        gi.embedding,
        gi.genres,
        gi.category_type,
        ARRAY(
            SELECT COALESCE(
                (elem ->> 'name')::text,
                elem::text
            )
            FROM jsonb_array_elements(COALESCE(gi.cached_tags, '[]'::jsonb)) AS elem
            WHERE elem IS NOT NULL
        )
    INTO source_embedding, source_genres, source_category, source_tags
    FROM public.global_items gi
    WHERE gi.id = source_item_id;

    IF source_embedding IS NULL THEN
        RETURN; 
    END IF;

    -- Category filter logic:
    -- 'ALL' = search all categories (set to NULL for no filtering)
    -- NULL = default to source item's category (same-category only)
    -- specific value = filter by that category
    IF category_filter = 'ALL' THEN
        effective_category_filter := NULL;
    ELSIF category_filter IS NULL THEN
        effective_category_filter := source_category;
    ELSE
        effective_category_filter := category_filter;
    END IF;

    RETURN QUERY
    SELECT
        gi.id,
        gi.title,
        gi.image_url,
        gi.category_type,
        gi.release_year,
        gi.runtime,
        gi.vote_average::float,
        (1 - (gi.embedding <=> source_embedding))::float as similarity,
        -- Find intersection of genres
        ARRAY(
            SELECT unnest(COALESCE(gi.genres, ARRAY[]::text[]))
            INTERSECT
            SELECT unnest(COALESCE(source_genres, ARRAY[]::text[]))
        ) as shared_genres,
        -- Find intersection of tags (robust handling)
        ARRAY(
            SELECT t.tag_name
            FROM (
                SELECT COALESCE(
                    (elem ->> 'name')::text,
                    elem::text
                ) as tag_name
                FROM jsonb_array_elements(COALESCE(gi.cached_tags, '[]'::jsonb)) AS elem
                WHERE elem IS NOT NULL
            ) t
            INTERSECT
            SELECT unnest(COALESCE(source_tags, ARRAY[]::text[]))
        ) as shared_tags
    FROM public.global_items gi
    WHERE
        gi.embedding IS NOT NULL
        AND gi.id != source_item_id
        AND (effective_category_filter IS NULL OR gi.category_type = effective_category_filter)
    ORDER BY gi.embedding <=> source_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_items_with_reasons TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_similar_items_with_reasons TO anon;
