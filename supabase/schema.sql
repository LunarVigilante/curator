-- ============================================================================
-- CURATOR DATABASE SCHEMA FOR SUPABASE
-- Run this in the Supabase SQL Editor to create all tables
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'MODERATOR');
CREATE TYPE item_status AS ENUM ('ACTIVE', 'IGNORED', 'WISHLIST', 'SEEN');
CREATE TYPE rating_type AS ENUM ('NUMERICAL', 'TIER', 'HYBRID');
CREATE TYPE rank_sentiment AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');
CREATE TYPE rank_type AS ENUM ('RANKED', 'UTILITY');

-- ============================================================================
-- USER PROFILES (Synced from auth.users)
-- ============================================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    display_name TEXT,
    image TEXT,
    bio TEXT,
    cover_image TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    profile_views INTEGER DEFAULT 0,
    preferences JSONB,
    role user_role DEFAULT 'USER',
    email_verified BOOLEAN DEFAULT FALSE,
    is_locked_out BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CATEGORIES
-- ============================================================================

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image TEXT,
    color TEXT,
    emoji TEXT,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB,
    is_template BOOLEAN DEFAULT FALSE,
    is_challenge BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    cached_analysis JSONB,
    analysis_hash TEXT,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GLOBAL ITEMS (Master Item Store)
-- ============================================================================

CREATE TABLE global_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT, -- Legacy singular ID
    external_ids JSONB DEFAULT '{}', -- Maps provider -> id (e.g. {"tmdb": "123", "anilist": "456"})
    source TEXT, -- 'tmdb', 'anilist', 'spotify', etc.
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    release_year INTEGER,
    metadata JSONB DEFAULT '{}',
    cached_tags JSONB,
    category_type TEXT,
    vector_text TEXT,
    last_metadata_update TIMESTAMPTZ,
    
    -- Anime specific
    episodes INTEGER,
    season TEXT,
    source_material TEXT,
    romaji_title TEXT,
    original_creator TEXT,

    -- Gaming specific
    platforms TEXT[],
    developers TEXT[],
    publishers TEXT[],
    playtime INTEGER,
    metacritic INTEGER,

    -- Media specific
    cast TEXT[],
    director TEXT,
    writer TEXT,
    studio TEXT,
    genres TEXT[],
    content_rating TEXT,
    runtime INTEGER,
    vote_average NUMERIC,
    trailer_url TEXT,
    tagline TEXT,

    embedding extensions.vector(1024),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source, external_id)
);

-- ============================================================================
-- ITEMS (User's Item Instances)
-- ============================================================================

CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    description TEXT,
    image TEXT,
    metadata JSONB,
    status item_status DEFAULT 'ACTIVE',
    tier TEXT,
    rank INTEGER,
    notes TEXT,
    elo_score FLOAT DEFAULT 1200,
    global_item_id UUID REFERENCES global_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TAGS
-- ============================================================================

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE items_to_tags (
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

-- ============================================================================
-- RATINGS
-- ============================================================================

CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    value FLOAT NOT NULL,
    tier TEXT,
    custom_rank TEXT,
    type rating_type NOT NULL,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CUSTOM RANKS
-- ============================================================================

CREATE TABLE custom_ranks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    sentiment rank_sentiment NOT NULL,
    sort_order INTEGER DEFAULT 0,
    color TEXT,
    type rank_type DEFAULT 'RANKED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INTERACTION LAYER
-- ============================================================================

CREATE TABLE user_challenges (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'ACTIVE',
    progress INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, category_id)
);

CREATE TABLE curator_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES collection_comments(id),
    content TEXT NOT NULL,
    is_creator_reply BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE share_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    share_hash TEXT UNIQUE NOT NULL,
    template TEXT DEFAULT 'default',
    image_url TEXT,
    metadata JSONB,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_likes (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, category_id)
);

CREATE TABLE collection_saves (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, category_id)
);

CREATE TABLE collection_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    tag TEXT NOT NULL,
    added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_admin_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_top_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    pinned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE follows (
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS
-- ============================================================================

CREATE TABLE taste_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    value FLOAT NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE taste_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    snapshot_type TEXT NOT NULL,
    metrics_json JSONB NOT NULL,
    item_count INTEGER NOT NULL,
    top_genres_json JSONB,
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cohort_averages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_type TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    avg_value FLOAT NOT NULL,
    stddev_value FLOAT,
    sample_size INTEGER NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE insight_unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    insight_key TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    unlock_context JSONB
);

CREATE TABLE unlock_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_key TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    category_scoped BOOLEAN DEFAULT FALSE,
    display_label TEXT NOT NULL
);

-- ============================================================================
-- SYSTEM
-- ============================================================================

CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    variables JSONB,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    max_uses INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0,
    used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_category_id ON items(category_id);
CREATE INDEX idx_items_global_item_id ON items(global_item_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_global_items_source_external ON global_items(source, external_id);
CREATE INDEX idx_global_items_external_ids ON global_items USING gin (external_ids);
CREATE INDEX idx_global_items_embedding ON global_items USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX idx_ratings_item_id ON ratings(item_id);
CREATE INDEX idx_ratings_user_id ON ratings(user_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);

-- ============================================================================
-- AUTH SYNC TRIGGER (Creates profile when user signs up)
-- Syncs role and email_verified from user metadata, handles conflicts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        email, 
        name, 
        role,
        email_verified,
        created_at, 
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'USER'),
        COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, false),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, profiles.name),
        role = CASE 
            WHEN EXCLUDED.role = 'ADMIN' THEN 'ADMIN'::user_role 
            ELSE profiles.role 
        END,
        email_verified = COALESCE(EXCLUDED.email_verified, profiles.email_verified),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Handle email updates from auth.users
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email, updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_update();

-- Clean up profile when user is deleted
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'ADMIN'
  );
$$;

-- Get current user's profile
CREATE OR REPLACE FUNCTION public.get_current_profile()
RETURNS public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

-- Computed Column: description_length for filtering
CREATE OR REPLACE FUNCTION description_length(row global_items)
RETURNS integer AS $$
  SELECT char_length(COALESCE(row.description, ''));
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: Own profile + public profiles + service role
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Public profiles are viewable" ON profiles FOR SELECT USING (is_public = true);
CREATE POLICY "Service role can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Categories: Own + public + featured
CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public categories are viewable" ON categories FOR SELECT USING (is_public = true);
CREATE POLICY "Featured categories are viewable" ON categories FOR SELECT USING (is_featured = true);
CREATE POLICY "Users can manage own categories" ON categories FOR ALL USING (auth.uid() = user_id);

-- Items: Own items
CREATE POLICY "Users can manage own items" ON items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Items in public categories are viewable" ON items FOR SELECT USING (
    EXISTS (SELECT 1 FROM categories WHERE categories.id = items.category_id AND categories.is_public = true)
);

-- Ratings: Own ratings
CREATE POLICY "Users can manage own ratings" ON ratings FOR ALL USING (auth.uid() = user_id);

-- System settings: Admin only via service role
CREATE POLICY "Service role can access settings" ON system_settings FOR ALL USING (auth.role() = 'service_role');

-- Tags: Anyone can read, authenticated can create, admins can manage
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tags" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tags" ON public.tags FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage tags" ON public.tags FOR ALL USING (public.is_admin());

-- Global Items: Anyone can read, authenticated can create/update (for AI enrichment)
ALTER TABLE public.global_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read global items" ON public.global_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create global items" ON public.global_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update global items" ON public.global_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage global items" ON public.global_items FOR ALL USING (public.is_admin());

-- Activities: Own policies
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own activities" ON public.activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own activities" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public user activities are viewable" ON public.activities FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = activities.user_id AND profiles.is_public = true)
);

-- ============================================================================
-- STORAGE: Media Bucket for File Uploads
-- ============================================================================

-- Create the 'media' bucket for all file uploads (avatars, covers, posters)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('media', 'media', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('images', 'images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: Allow public read access for all buckets
CREATE POLICY "Public read access for media" ON storage.objects FOR SELECT TO public USING (bucket_id = 'media');
CREATE POLICY "Public read access for images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'images');
CREATE POLICY "Public read access for covers" ON storage.objects FOR SELECT TO public USING (bucket_id = 'covers');

-- Storage RLS: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media');

-- Storage RLS: Allow users to update their uploads
CREATE POLICY "Users can update their uploads" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'media');

-- Storage RLS: Allow users to delete their uploads
CREATE POLICY "Users can delete their uploads" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'media');

-- Storage RLS: Allow service role full access (for Edge Functions)
CREATE POLICY "Service role full access to media" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

-- ============================================================================
-- INVITES: RLS Policies
-- ============================================================================

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admins can view all invites
CREATE POLICY "Admins can view invites" ON public.invites FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'));

-- Admins can create invites
CREATE POLICY "Admins can create invites" ON public.invites FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'));

-- Admins can manage (update/delete) invites
CREATE POLICY "Admins can manage invites" ON public.invites FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'));

-- Index for faster lookups on active invites
CREATE INDEX idx_invites_active ON public.invites(code) WHERE use_count < max_uses;

-- ============================================================================
-- ADMIN PERMISSIONS: Additional Policies
-- ============================================================================

-- Admins can view ALL categories (including private)
CREATE POLICY "Admins can view all categories" ON public.categories FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'));

-- Admins can view ALL profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'));

-- Admins can manage all profiles (update/delete)
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'));

-- ============================================================================
-- SEARCH ITEMS: Find similar items by embedding (cosine similarity)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_items(
    query_embedding extensions.vector(1024),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    image_url TEXT,
    category_type TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.title,
        g.description,
        g.image_url,
        g.category_type,
        (1 - (g.embedding <=> query_embedding))::FLOAT AS similarity
    FROM global_items g
    WHERE g.embedding IS NOT NULL
      AND (category_filter IS NULL OR g.category_type = category_filter)
      AND (1 - (g.embedding <=> query_embedding)) > match_threshold
    ORDER BY g.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_items TO authenticated;

-- Simplified search returning specific fields for UI
CREATE OR REPLACE FUNCTION public.search_items_by_vector(
    query_embedding extensions.vector(1024),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    "posterUrl" TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.title,
        g.image_url AS "posterUrl",
        (1 - (g.embedding <=> query_embedding))::FLOAT AS similarity
    FROM global_items g
    WHERE g.embedding IS NOT NULL
      AND (1 - (g.embedding <=> query_embedding)) > match_threshold
    ORDER BY g.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_items_by_vector TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_items_by_vector TO anon;

-- ============================================================================
-- TASTE COMPATIBILITY: Hybrid ELO + Vector similarity
-- Returns 0-100 (percentage) or -1 if insufficient data (< 5 shared items)
-- Uses embeddings for semantic similarity when available
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_taste_compatibility(
    user_a_id UUID, 
    user_b_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    shared_count INTEGER;
    elo_distance FLOAT := 0;
    vector_similarity FLOAT := 0;
    vector_count INTEGER := 0;
    max_elo_distance FLOAT;
    elo_score FLOAT;
    vec_score FLOAT;
    final_score INTEGER;
BEGIN
    -- Create temp table with shared items (matched by global_item_id)
    CREATE TEMP TABLE temp_shared ON COMMIT DROP AS
    SELECT 
        a.global_item_id,
        a.elo_score AS elo_a,
        b.elo_score AS elo_b,
        ga.embedding AS embedding_a,
        gb.embedding AS embedding_b
    FROM items a
    INNER JOIN items b ON a.global_item_id = b.global_item_id
    LEFT JOIN global_items ga ON a.global_item_id = ga.id
    LEFT JOIN global_items gb ON b.global_item_id = gb.id
    WHERE a.user_id = user_a_id
      AND b.user_id = user_b_id
      AND a.global_item_id IS NOT NULL
      AND a.elo_score IS NOT NULL
      AND b.elo_score IS NOT NULL;
    
    -- Count shared items
    SELECT COUNT(*) INTO shared_count FROM temp_shared;
    
    -- Require minimum 5 shared items
    IF shared_count < 5 THEN
        RETURN -1;
    END IF;
    
    -- Calculate ELO-based distance (traditional method)
    SELECT COALESCE(SUM(ABS(elo_a - elo_b)), 0) 
    INTO elo_distance 
    FROM temp_shared;
    
    max_elo_distance := shared_count * 800.0;
    elo_score := (1.0 - (elo_distance / max_elo_distance)) * 100;
    
    -- Calculate vector similarity if embeddings available
    SELECT 
        COUNT(*),
        AVG(1 - (embedding_a <=> embedding_b)) * 100
    INTO vector_count, vector_similarity
    FROM temp_shared
    WHERE embedding_a IS NOT NULL AND embedding_b IS NOT NULL;
    
    -- Combine scores: weight vector similarity higher when available
    IF vector_count >= 3 THEN
        -- Hybrid: 60% vector similarity, 40% ELO
        final_score := ROUND((vector_similarity * 0.6) + (elo_score * 0.4))::INTEGER;
    ELSE
        -- Fallback: 100% ELO
        final_score := ROUND(elo_score)::INTEGER;
    END IF;
    
    -- Clamp to 0-100
    RETURN GREATEST(0, LEAST(100, final_score));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_taste_compatibility(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_taste_compatibility(UUID, UUID) TO anon;
