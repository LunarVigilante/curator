-- Add semantic_hash column for change detection
-- Allows reharvest script to skip AI regeneration when TMDB content hasn't changed
ALTER TABLE public.global_items ADD COLUMN IF NOT EXISTS semantic_hash TEXT;

-- Index for quick lookup of items missing semantic hash (first-run backfill)
CREATE INDEX IF NOT EXISTS idx_missing_semantic_hash
ON public.global_items (created_at DESC)
WHERE semantic_hash IS NULL;

COMMENT ON COLUMN public.global_items.semantic_hash IS 'SHA-256 hash of semantic fields (title, overview, cast, genres). Used by reharvest to skip AI regen when content unchanged.';
