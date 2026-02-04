-- Add bucket_type, genre_lens, and is_anthology columns for TV show classification
-- These enable the 3-bucket system and hard partition filtering for vector search

-- ============================================================================
-- Add TV classification columns to global_items
-- ============================================================================
ALTER TABLE public.global_items 
ADD COLUMN IF NOT EXISTS bucket_type text;

ALTER TABLE public.global_items 
ADD COLUMN IF NOT EXISTS genre_lens text;

ALTER TABLE public.global_items 
ADD COLUMN IF NOT EXISTS is_anthology boolean DEFAULT false;

-- Create index for bucket_type filtering (used in vector search pre-filtering)
CREATE INDEX IF NOT EXISTS global_items_bucket_type_idx 
ON public.global_items (bucket_type) 
WHERE bucket_type IS NOT NULL;

-- Note: The match_documents RPC will be updated in a subsequent migration
-- after these columns are confirmed to exist.
