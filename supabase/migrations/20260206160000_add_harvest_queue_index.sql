-- Migration: Add harvest queue index for finding items needing AI analysis
-- This partial index enables instant lookups for the Janitor lane (scripts)

-- Items missing bucket_type OR vibe scores need processing
CREATE INDEX IF NOT EXISTS idx_harvest_queue 
ON public.global_items (created_at DESC) 
WHERE bucket_type IS NULL OR vibe_scores IS NULL OR vibe_scores = '{}'::jsonb;

-- Items missing embeddings
CREATE INDEX IF NOT EXISTS idx_missing_embeddings 
ON public.global_items (created_at DESC) 
WHERE embedding IS NULL;
