-- PART 4: TOPSIS TABLES & DATA
-- Run this last. Creates tables and seeds default data.

-- 1. Create Tables
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

-- 2. Enable RLS
ALTER TABLE public.criteria_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_criteria_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_criteria_weights ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Anyone can read criteria definitions"
ON public.criteria_definitions FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can manage their own criterion ratings"
ON public.user_criteria_ratings FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own criterion weights"
ON public.user_criteria_weights FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Seed Data
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
