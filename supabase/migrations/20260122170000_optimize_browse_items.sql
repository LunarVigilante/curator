-- Enable pg_trgm extension for fuzzy text search (if not exists)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index on title for faster ILIKE searches
CREATE INDEX IF NOT EXISTS idx_global_items_title_trgm 
ON global_items USING gin(title gin_trgm_ops);

-- Update browse_items RPC with performance optimizations:
-- 1. Use approximate count when no filters (instant)
-- 2. Increase timeout to 15s for filtered queries
-- 3. Use trigram similarity for search
CREATE OR REPLACE FUNCTION public.browse_items(
    p_category_types text[] DEFAULT NULL::text[], 
    p_search text DEFAULT NULL::text, 
    p_page integer DEFAULT 1, 
    p_page_size integer DEFAULT 50, 
    p_sort_field text DEFAULT 'last_metadata_update'::text, 
    p_sort_order text DEFAULT 'desc'::text
)
RETURNS TABLE(
    id uuid, 
    title text, 
    description text, 
    image_url text, 
    backdrop_path text, 
    category_type text, 
    release_year integer, 
    genres text[], 
    cached_tags jsonb, 
    director text, 
    studio text, 
    vote_average numeric, 
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '15s'
AS $function$
DECLARE
    v_offset integer;
    v_total bigint;
    v_has_filters boolean;
BEGIN
    v_offset := (p_page - 1) * p_page_size;
    v_has_filters := (p_category_types IS NOT NULL) OR (p_search IS NOT NULL AND p_search <> '');
    
    -- Use approximate count when no filters (instant), exact count when filtered
    IF NOT v_has_filters THEN
        -- Fast path: use pg_class reltuples for approximate count
        SELECT reltuples::bigint INTO v_total
        FROM pg_class
        WHERE relname = 'global_items';
    ELSE
        -- Filtered path: need exact count (but limited scope)
        SELECT count(*) INTO v_total
        FROM global_items gi
        WHERE (p_category_types IS NULL OR gi.category_type = ANY(p_category_types))
          AND (p_search IS NULL OR p_search = '' OR gi.title ILIKE '%' || p_search || '%');
    END IF;
    
    -- Return results with total count
    RETURN QUERY
    SELECT 
        gi.id,
        gi.title,
        LEFT(gi.description, 200) as description,
        gi.image_url,
        gi.backdrop_path,
        gi.category_type,
        gi.release_year,
        gi.genres,
        gi.cached_tags,
        gi.director,
        gi.studio,
        gi.vote_average,
        v_total as total_count
    FROM global_items gi
    WHERE (p_category_types IS NULL OR gi.category_type = ANY(p_category_types))
      AND (p_search IS NULL OR p_search = '' OR gi.title ILIKE '%' || p_search || '%')
    ORDER BY 
        CASE WHEN p_sort_order = 'desc' THEN
            CASE p_sort_field
                WHEN 'last_metadata_update' THEN gi.last_metadata_update
                WHEN 'created_at' THEN gi.created_at
                WHEN 'release_year' THEN gi.release_year::text::timestamp
                WHEN 'title' THEN NULL -- handled separately
            END
        END DESC NULLS LAST,
        CASE WHEN p_sort_order = 'asc' THEN
            CASE p_sort_field
                WHEN 'last_metadata_update' THEN gi.last_metadata_update
                WHEN 'created_at' THEN gi.created_at
                WHEN 'release_year' THEN gi.release_year::text::timestamp
                WHEN 'title' THEN NULL
            END
        END ASC NULLS LAST,
        -- Title sort (text, not timestamp)
        CASE WHEN p_sort_field = 'title' AND p_sort_order = 'asc' THEN gi.title END ASC NULLS LAST,
        CASE WHEN p_sort_field = 'title' AND p_sort_order = 'desc' THEN gi.title END DESC NULLS LAST
    LIMIT p_page_size
    OFFSET v_offset;
END;
$function$;

-- Add comment
COMMENT ON FUNCTION public.browse_items IS 'Optimized Data Browser RPC with approximate counts and trigram search support';
