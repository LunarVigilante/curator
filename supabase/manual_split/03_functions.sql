-- PART 3: FUNCTIONS (RPCs)
-- Run this third. These are just definitions, should be very fast.

-- 1. Search RPC
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 20,
    category_filter text DEFAULT NULL
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
SET search_path = public, extensions
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
        AND (1 - (gi.embedding <=> query_embedding)) > match_threshold
    ORDER BY gi.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_documents TO authenticated;

-- 2. Find Similar RPC
CREATE OR REPLACE FUNCTION public.find_similar_items(
    source_item_id uuid,
    match_count int DEFAULT 10,
    category_filter text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    image_url text,
    category_type text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    source_embedding vector(1024);
BEGIN
    SELECT gi.embedding INTO source_embedding
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
        (1 - (gi.embedding <=> source_embedding))::float as similarity
    FROM public.global_items gi
    WHERE
        gi.embedding IS NOT NULL
        AND gi.id != source_item_id
        AND (category_filter IS NULL OR gi.category_type = category_filter)
    ORDER BY gi.embedding <=> source_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_items TO authenticated;

-- 3. Borda Ranking RPC
CREATE OR REPLACE FUNCTION public.get_borda_rankings(
    p_category_type text DEFAULT NULL,
    p_limit int DEFAULT 50,
    p_min_voters int DEFAULT 3
)
RETURNS TABLE (
    global_item_id uuid,
    title text,
    image_url text,
    borda_score float,
    voter_count bigint,
    tier_distribution jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH tier_points AS (
        SELECT
            i.global_item_id as item_id,
            CASE i.tier
                WHEN 'S' THEN 7
                WHEN 'A' THEN 6
                WHEN 'B' THEN 5
                WHEN 'C' THEN 4
                WHEN 'D' THEN 3
                WHEN 'E' THEN 2
                WHEN 'F' THEN 1
                ELSE 0
            END as points,
            i.tier
        FROM public.items i
        WHERE i.tier IS NOT NULL
          AND i.global_item_id IS NOT NULL
          AND (p_category_type IS NULL OR i.category_type = p_category_type)
    ),
    aggregated AS (
        SELECT
            tp.item_id,
            AVG(tp.points)::float as avg_score,
            COUNT(*)::bigint as vote_count,
            jsonb_object_agg(tp.tier, tp.tier_count) as tier_dist
        FROM (
            SELECT
                item_id,
                points,
                tier,
                COUNT(*) as tier_count
            FROM tier_points
            GROUP BY item_id, tier, points
        ) tp
        GROUP BY tp.item_id
        HAVING COUNT(*) >= p_min_voters
    )
    SELECT
        a.item_id as global_item_id,
        gi.title,
        gi.image_url,
        a.avg_score as borda_score,
        a.vote_count as voter_count,
        a.tier_dist as tier_distribution
    FROM aggregated a
    JOIN public.global_items gi ON gi.id = a.item_id
    ORDER BY a.avg_score DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_borda_rankings TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_borda_rankings TO anon;
