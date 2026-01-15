-- Add music-specific columns to global_items
-- Run this in Supabase SQL Editor

-- Artist columns
ALTER TABLE public.global_items 
ADD COLUMN IF NOT EXISTS popularity integer,
ADD COLUMN IF NOT EXISTS followers integer;

-- Album columns  
ALTER TABLE public.global_items
ADD COLUMN IF NOT EXISTS album_type text,
ADD COLUMN IF NOT EXISTS total_tracks integer,
ADD COLUMN IF NOT EXISTS label text,
ADD COLUMN IF NOT EXISTS upc text;

-- Track columns
ALTER TABLE public.global_items
ADD COLUMN IF NOT EXISTS duration_ms integer,
ADD COLUMN IF NOT EXISTS preview_url text,
ADD COLUMN IF NOT EXISTS isrc text,
ADD COLUMN IF NOT EXISTS audio_features jsonb,
ADD COLUMN IF NOT EXISTS artist_names text[],
ADD COLUMN IF NOT EXISTS album_name text,
ADD COLUMN IF NOT EXISTS track_number integer;

-- Add comments for documentation
COMMENT ON COLUMN public.global_items.popularity IS 'Spotify popularity score (0-100) for artists/albums';
COMMENT ON COLUMN public.global_items.followers IS 'Spotify follower count for artists';
COMMENT ON COLUMN public.global_items.album_type IS 'album, single, compilation, ep';
COMMENT ON COLUMN public.global_items.total_tracks IS 'Number of tracks on album';
COMMENT ON COLUMN public.global_items.label IS 'Record label name';
COMMENT ON COLUMN public.global_items.duration_ms IS 'Track duration in milliseconds';
COMMENT ON COLUMN public.global_items.audio_features IS 'Spotify audio features (danceability, energy, tempo, etc)';
COMMENT ON COLUMN public.global_items.artist_names IS 'Array of artist names for track';
COMMENT ON COLUMN public.global_items.album_name IS 'Album name for track linkage';
