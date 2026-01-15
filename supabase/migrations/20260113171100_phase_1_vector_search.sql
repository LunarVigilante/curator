-- Phase 1: Vector Embedding & Hybrid Search Infrastructure
-- Uses Voyage-3 embeddings (1024 dimensions)

-- ============================================================================
-- STEP 1: Enable pgvector extension
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================================
-- STEP 2: Add embedding column to global_items
-- ============================================================================
ALTER TABLE public.global_items
ADD COLUMN IF NOT EXISTS embedding extensions.vector(1024);

-- ============================================================================
-- STEP 3: Create HNSW index for fast cosine similarity search
-- ============================================================================
CREATE INDEX IF NOT EXISTS global_items_embedding_hnsw_idx
ON public.global_items
USING hnsw (embedding extensions.vector_cosine_ops);

-- ============================================================================
-- STEP 4: Create RPC function for semantic similarity search
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding extensions.vector(1024),
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.match_documents TO authenticated;

-- ============================================================================
-- STEP 5: Create RPC for finding similar items by item ID
-- ============================================================================
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
    source_embedding extensions.vector(1024);
BEGIN
    -- Get the source item's embedding
    SELECT gi.embedding INTO source_embedding
    FROM public.global_items gi
    WHERE gi.id = source_item_id;

    IF source_embedding IS NULL THEN
        RETURN; -- Return empty if no embedding
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

-- ============================================================================
-- STEP 6: Create Borda Count rankings RPC
-- ============================================================================
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

-- ============================================================================
-- STEP 7: Create TOPSIS-related tables
-- ============================================================================

-- Criteria definitions per category
CREATE TABLE IF NOT EXISTS public.criteria_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_type text NOT NULL,
    criterion_name text NOT NULL,
    criterion_key text NOT NULL,
    description text,
    default_weight float DEFAULT 0.2,
    display_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(category_type, criterion_key)
);

-- User ratings per criterion per item
CREATE TABLE IF NOT EXISTS public.user_criteria_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    criterion_key text NOT NULL,
    rating int NOT NULL CHECK (rating >= 1 AND rating <= 10),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, item_id, criterion_key)
);

-- User weight preferences per category
CREATE TABLE IF NOT EXISTS public.user_criteria_weights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_type text NOT NULL,
    criterion_key text NOT NULL,
    weight float NOT NULL CHECK (weight >= 0 AND weight <= 1),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, category_type, criterion_key)
);

-- Enable RLS
ALTER TABLE public.criteria_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_criteria_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_criteria_weights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for criteria_definitions (read-only for all)
CREATE POLICY "Anyone can read criteria definitions"
ON public.criteria_definitions FOR SELECT
TO authenticated, anon
USING (true);

-- RLS Policies for user_criteria_ratings
CREATE POLICY "Users can manage their own criterion ratings"
ON public.user_criteria_ratings FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_criteria_weights
CREATE POLICY "Users can manage their own criterion weights"
ON public.user_criteria_weights FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- STEP 8: Seed default criteria definitions
-- ============================================================================

-- Movies
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('movie', 'Acting', 'acting', 0.22, 1),
('movie', 'Plot', 'plot', 0.25, 2),
('movie', 'Cinematography', 'cinematography', 0.18, 3),
('movie', 'Soundtrack', 'soundtrack', 0.15, 4),
('movie', 'Pacing', 'pacing', 0.20, 5)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- TV Shows
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('tv_show', 'Acting', 'acting', 0.20, 1),
('tv_show', 'Writing', 'writing', 0.25, 2),
('tv_show', 'Character Development', 'character_development', 0.20, 3),
('tv_show', 'Binge-worthiness', 'binge_worthiness', 0.15, 4),
('tv_show', 'Production', 'production', 0.20, 5)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Video Games
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('video_game', 'Gameplay', 'gameplay', 0.30, 1),
('video_game', 'Graphics', 'graphics', 0.15, 2),
('video_game', 'Story', 'story', 0.20, 3),
('video_game', 'Replayability', 'replayability', 0.20, 4),
('video_game', 'Sound Design', 'sound_design', 0.15, 5)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Board Games
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('board_game', 'Strategy Depth', 'strategy_depth', 0.25, 1),
('board_game', 'Accessibility', 'accessibility', 0.20, 2),
('board_game', 'Replayability', 'replayability', 0.20, 3),
('board_game', 'Theme Integration', 'theme_integration', 0.15, 4),
('board_game', 'Component Quality', 'component_quality', 0.20, 5)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Books
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('book', 'Writing Style', 'writing_style', 0.25, 1),
('book', 'Plot', 'plot', 0.25, 2),
('book', 'Characters', 'characters', 0.20, 3),
('book', 'World-building', 'world_building', 0.15, 4),
('book', 'Pacing', 'pacing', 0.15, 5)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Podcasts
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('podcast', 'Host Chemistry', 'host_chemistry', 0.25, 1),
('podcast', 'Content Depth', 'content_depth', 0.25, 2),
('podcast', 'Audio Engineering', 'audio_engineering', 0.15, 3),
('podcast', 'Flow', 'flow', 0.20, 4),
('podcast', 'Consistency', 'consistency', 0.15, 5)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Comics/Manga
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('comic', 'Art Quality', 'art_quality', 0.25, 1),
('comic', 'Panel Layout/Flow', 'panel_layout', 0.15, 2),
('comic', 'Story Arc', 'story_arc', 0.25, 3),
('comic', 'Character Consistency', 'character_consistency', 0.20, 4),
('comic', 'Lettering/Translation', 'lettering_translation', 0.15, 5),
('manga', 'Art Quality', 'art_quality', 0.25, 1),
('manga', 'Panel Layout/Flow', 'panel_layout', 0.15, 2),
('manga', 'Story Arc', 'story_arc', 0.25, 3),
('manga', 'Character Consistency', 'character_consistency', 0.20, 4),
('manga', 'Lettering/Translation', 'lettering_translation', 0.15, 5)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Light Novels
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('light_novel', 'Prose/Translation', 'prose_translation', 0.25, 1),
('light_novel', 'Character Tropes', 'character_tropes', 0.20, 2),
('light_novel', 'Illustration Integration', 'illustration_integration', 0.15, 3),
('light_novel', 'World Building', 'world_building', 0.20, 4),
('light_novel', 'Pacing', 'pacing', 0.20, 5)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Music Artists
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('music_artist', 'Discography', 'discography', 0.30, 1),
('music_artist', 'Live Performance', 'live_performance', 0.25, 2),
('music_artist', 'Influence', 'influence', 0.25, 3),
('music_artist', 'Versatility', 'versatility', 0.20, 4)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Music Albums
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('music_album', 'Cohesion', 'cohesion', 0.25, 1),
('music_album', 'Production', 'production', 0.25, 2),
('music_album', 'Thematic Depth', 'thematic_depth', 0.25, 3),
('music_album', 'No-Skip Factor', 'no_skip_factor', 0.25, 4)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Music Tracks
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('music_track', 'Melody', 'melody', 0.30, 1),
('music_track', 'Production', 'production', 0.25, 2),
('music_track', 'Emotional Impact', 'emotional_impact', 0.25, 3),
('music_track', 'Rhythm', 'rhythm', 0.20, 4)
ON CONFLICT (category_type, criterion_key) DO NOTHING;

-- Anime
INSERT INTO public.criteria_definitions (category_type, criterion_name, criterion_key, default_weight, display_order) VALUES
('anime', 'Animation', 'animation', 0.25, 1),
('anime', 'Story', 'story', 0.25, 2),
('anime', 'Voice Acting/Sound', 'voice_acting_sound', 0.15, 3),
('anime', 'Character Design', 'character_design', 0.20, 4),
('anime', 'Soundtrack', 'soundtrack', 0.15, 5)
ON CONFLICT (category_type, criterion_key) DO NOTHING;
