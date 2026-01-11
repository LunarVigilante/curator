-- RPC to get distinct values for filters with counts
-- Handles both scalar and array columns securely

CREATE OR REPLACE FUNCTION get_filter_values(
  p_column text,
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS TABLE (value text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_query text;
    v_where text := '';
BEGIN
    -- Validate column name to prevent injection
    IF p_column NOT IN (
        'director', 'writer', 'studio', 'cast', 'genres', 
        'content_rating', 'release_year', 
        'developers', 'publishers', 'platforms', 
        'designers', 'mechanics', 'artists', 'categories',
        'origin_countries'
    ) THEN
        RAISE EXCEPTION 'Invalid column name: %', p_column;
    END IF;

    -- Base WHERE clause
    IF p_category IS NOT NULL THEN
        v_where := format('WHERE category_type = %L', p_category);
    END IF;

    -- Handle Array Columns (unnest)
    IF p_column IN ('cast', 'genres', 'developers', 'publishers', 'platforms', 'designers', 'mechanics', 'artists', 'categories', 'origin_countries') THEN
        v_query := format('
            SELECT unnest(%I) as val
            FROM global_items
            %s
        ', p_column, v_where);
        
        -- Aggregate outer to count correctly
        v_query := format('
            SELECT val, count(*) as cnt
            FROM (%s) sub_unnest
            GROUP BY val
        ', v_query);

    ELSE
        -- Handle Scalar Columns
        v_query := format('
            SELECT %I::text as val, count(*) as cnt
            FROM global_items
            %s
            GROUP BY val
        ', p_column, v_where);
    END IF;

    -- Filter empty/null and apply search
    v_query := format('
        SELECT val, cnt
        FROM (%s) sub_agg
        WHERE val IS NOT NULL AND val != ''''
    ', v_query);

    IF p_search IS NOT NULL AND p_search != '' THEN
        v_query := v_query || format(' AND val ILIKE %L', '%' || p_search || '%');
    END IF;

    v_query := v_query || format(' ORDER BY cnt DESC, val ASC LIMIT %s', p_limit);

    RETURN QUERY EXECUTE v_query;
END;
$$;
