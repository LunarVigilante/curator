-- Create browse_items RPC for optimized Data Browser
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
SET statement_timeout TO '8s'
AS $function$
DECLARE
    v_offset integer;
    v_total bigint;
BEGIN
    v_offset := (p_page - 1) * p_page_size;
    
    -- Get total count first (estimated for speed)
    SELECT count(*) INTO v_total
    FROM global_items gi
    WHERE (p_category_types IS NULL OR gi.category_type = ANY(p_category_types))
      AND (p_search IS NULL OR p_search = '' OR gi.title ILIKE '%' || p_search || '%');
    
    -- Return results with total count
    RETURN QUERY
    SELECT 
        gi.id,
        gi.title,
        LEFT(gi.description, 200) as description,  -- Truncate for grid display
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
            END
        END DESC NULLS LAST,
        CASE WHEN p_sort_order = 'asc' THEN
            CASE p_sort_field
                WHEN 'last_metadata_update' THEN gi.last_metadata_update
                WHEN 'created_at' THEN gi.created_at
                WHEN 'release_year' THEN gi.release_year::text::timestamp
            END
        END ASC NULLS LAST
    LIMIT p_page_size
    OFFSET v_offset;
END;
$function$;
