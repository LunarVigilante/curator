-- =============================================================================
-- v5.3: Hybrid Similarity Search (Dense + Sparse + Boosts/Penalties)
-- Implements the "Contrast Card" scoring logic:
-- Final Score = (Dense Vector Score * 0.6) + (Sparse Categorical Score * 0.3) + Boosts/Penalties
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_hybrid_similar_items(
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
    vote_average float,
    runtime int,
    similarity float,
    hybrid_score float,
    shared_traits text[],
    difference_factors text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    source_embedding vector(1024);
    source_metadata jsonb;
    source_category text;
    source_year int;
    source_u_id text;
    source_franchise text;
    source_archetype text;
    source_format text;
    source_genre_lens text;
    
    -- Weights (Configured here for easy tuning)
    w_dense float := 0.6;
    w_sparse float := 0.3;
BEGIN
    -- 1. Get source item data
    SELECT 
        gi.embedding,
        gi.metadata,
        gi.category_type,
        gi.release_year,
        gi.metadata->>'universe_id',
        gi.metadata->>'franchise_type',
        gi.metadata->>'archetype',
        gi.metadata->>'format_type',
        gi.metadata->>'genre_lens'
    INTO 
        source_embedding,
        source_metadata,
        source_category,
        source_year,
        source_u_id,
        source_franchise,
        source_archetype,
        source_format,
        source_genre_lens
    FROM public.global_items gi
    WHERE gi.id = source_item_id;

    IF source_embedding IS NULL THEN
        RETURN;
    END IF;

    -- Return top results re-ranked
    RETURN QUERY
    WITH candidates AS (
        -- Step 1: Retrieval (Vector Search) to get Top 100 Candidates
        SELECT
            gi.id,
            gi.title,
            gi.image_url,
            gi.category_type,
            gi.release_year,
            gi.vote_average::float as vote_average,  -- Cast to float to match return type
            gi.runtime,
            gi.metadata,
            1 - (gi.embedding <=> source_embedding) as vector_sim
        FROM public.global_items gi
        WHERE
            gi.embedding IS NOT NULL
            AND gi.id != source_item_id
            AND (category_filter IS NULL OR gi.category_type = category_filter)
        ORDER BY gi.embedding <=> source_embedding
        LIMIT 100
    ),
    scored AS (
        -- Step 2: Scoring & Feature Extraction
        SELECT
            c.*,
            -- Extract sparse matches
            (c.metadata->>'franchise_type' = source_franchise AND source_franchise IS NOT NULL) as match_franchise,
            (c.metadata->>'archetype' = source_archetype AND source_archetype IS NOT NULL) as match_archetype,
            (c.metadata->>'format_type' = source_format AND source_format IS NOT NULL) as match_format,
            (c.metadata->>'genre_lens' = source_genre_lens AND source_genre_lens IS NOT NULL) as match_lens,
            (c.metadata->>'universe_id' = source_u_id AND source_u_id IS NOT NULL) as match_universe,
            
            -- Calculate Sparse Score (0.3 max)
            (
                CASE WHEN (c.metadata->>'franchise_type' = source_franchise AND source_franchise IS NOT NULL) THEN 0.15 ELSE 0 END +
                CASE WHEN (c.metadata->>'archetype' = source_archetype AND source_archetype IS NOT NULL) THEN 0.10 ELSE 0 END +
                CASE WHEN (c.metadata->>'format_type' = source_format AND source_format IS NOT NULL) THEN 0.05 ELSE 0 END
            ) as sparse_score_raw,
            
            -- Penalties/Boosts
            (CASE WHEN (c.metadata->>'universe_id' = source_u_id AND source_u_id IS NOT NULL) THEN 0.15 ELSE 0 END) as boost_universe,
            (CASE WHEN c.category_type != source_category THEN 0.20 ELSE 0 END) as penalty_bucket,
            (CASE WHEN ABS(COALESCE(c.release_year, 0) - COALESCE(source_year, 0)) > 20 THEN 0.05 ELSE 0 END) as penalty_year
        FROM candidates c
    )
    SELECT
        s.id,
        s.title,
        s.image_url,
        s.category_type,
        s.release_year,
        s.vote_average,
        s.runtime,
        s.vector_sim::float as similarity,
        
        -- Final Hybrid Score Calculation
        (
            (s.vector_sim * w_dense) +
            s.sparse_score_raw + -- Already weighted implicitly by point values (sum=0.30)
            s.boost_universe -
            s.penalty_bucket -
            s.penalty_year
        )::float as hybrid_score,
        
        -- Shared Traits (for Green Chips)
        ARRAY_REMOVE(ARRAY[
            CASE WHEN s.match_franchise THEN 'Franchise: ' || (s.metadata->>'franchise_type') ELSE NULL END,
            CASE WHEN s.match_archetype THEN 'Archetype: ' || (s.metadata->>'archetype') ELSE NULL END,
            CASE WHEN s.match_format THEN 'Format: ' || (s.metadata->>'format_type') ELSE NULL END,
            CASE WHEN s.match_lens THEN 'Lens: ' || (s.metadata->>'genre_lens') ELSE NULL END,
            CASE WHEN s.match_universe THEN 'Shared Universe' ELSE NULL END
        ], NULL) as shared_traits,
        
        -- Contrast Factors (for Wedge)
        ARRAY_REMOVE(ARRAY[
            CASE WHEN s.penalty_bucket > 0 THEN 'Format Mismatch' ELSE NULL END,
            CASE WHEN s.penalty_year > 0 THEN 'Era Gap' ELSE NULL END,
            CASE WHEN NOT s.match_lens AND source_genre_lens IS NOT NULL THEN 'Diff Lens' ELSE NULL END
        ], NULL) as difference_factors
        
    FROM scored s
    ORDER BY hybrid_score DESC
    LIMIT match_count;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.find_hybrid_similar_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_hybrid_similar_items TO anon;
