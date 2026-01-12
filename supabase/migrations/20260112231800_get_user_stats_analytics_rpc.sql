-- Migration: Create get_user_stats_analytics RPC function
-- Replaces JS-side aggregation with efficient database-side computation
-- Fixes N+1 query problem and improves performance

CREATE OR REPLACE FUNCTION get_user_stats_analytics(
    p_user_id UUID,
    p_category_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    WITH tiered_items AS (
        -- Get all tiered items for user (with optional category filter)
        SELECT 
            i.id,
            i.tier,
            i.category_id,
            i.elo_score,
            g.title,
            g.image_url
        FROM items i
        LEFT JOIN global_items g ON i.global_item_id = g.id
        WHERE i.user_id = p_user_id
          AND i.tier IS NOT NULL
          AND (p_category_id IS NULL OR i.category_id = p_category_id)
    ),
    tier_distribution AS (
        -- Count items per tier
        SELECT 
            tier,
            COUNT(*)::int as count
        FROM tiered_items
        GROUP BY tier
        ORDER BY 
            CASE tier
                WHEN 'S' THEN 1
                WHEN 'A' THEN 2
                WHEN 'B' THEN 3
                WHEN 'C' THEN 4
                WHEN 'D' THEN 5
                WHEN 'F' THEN 6
                ELSE 7
            END
    ),
    top_tags AS (
        -- Get top 10 tags by frequency across tiered items
        SELECT 
            t.id as tag_id,
            t.name as tag_name,
            COUNT(*)::int as count
        FROM tiered_items ti
        JOIN items_to_tags itt ON ti.id = itt.item_id
        JOIN tags t ON itt.tag_id = t.id
        GROUP BY t.id, t.name
        ORDER BY count DESC
        LIMIT 10
    ),
    top_rated AS (
        -- Get top 4 S-tier items by ELO score
        SELECT 
            id,
            title as name,
            image_url as image,
            tier,
            category_id
        FROM tiered_items
        WHERE tier = 'S'
        ORDER BY elo_score DESC NULLS LAST
        LIMIT 4
    )
    SELECT json_build_object(
        'totalRated', (SELECT COUNT(*)::int FROM tiered_items),
        'tierDistribution', COALESCE((SELECT json_agg(row_to_json(td)) FROM tier_distribution td), '[]'::json),
        'topTags', COALESCE((SELECT json_agg(json_build_object('tagId', tag_id, 'tagName', tag_name, 'count', count)) FROM top_tags), '[]'::json),
        'topRated', COALESCE((SELECT json_agg(json_build_object('id', id, 'name', name, 'image', image, 'tier', tier, 'categoryId', category_id)) FROM top_rated), '[]'::json)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_stats_analytics(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats_analytics(UUID, UUID) TO anon;
