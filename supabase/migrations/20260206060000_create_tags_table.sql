-- Migration: Add slug, description, and category columns to existing tags table
-- This adds AI-generated descriptions and slug-based lookups

-- Step 1: Add slug column
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS slug TEXT;

-- Step 2: Populate all slugs from names
UPDATE public.tags 
SET slug = lower(trim(regexp_replace(regexp_replace(name, '\s+', '-', 'g'), '[^a-z0-9-]', '', 'gi')));

-- Step 3: Delete duplicates (keep first by id)
DELETE FROM public.tags 
WHERE id NOT IN (
  SELECT DISTINCT ON (slug) id 
  FROM public.tags 
  ORDER BY slug, id ASC
);

-- Step 4: Make NOT NULL and create unique index
ALTER TABLE public.tags ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_slug ON public.tags (slug);

-- Step 5: Add description, category, source_type, and created_at columns
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'ai';
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Comments
COMMENT ON COLUMN public.tags.slug IS 'URL-friendly unique identifier derived from name';
COMMENT ON COLUMN public.tags.description IS 'AI-generated description explaining the tag meaning for tooltips';
COMMENT ON COLUMN public.tags.category IS 'Tag category: mood, theme, style, narrative, pacing, tone';
COMMENT ON COLUMN public.tags.source_type IS 'How the tag was created: ai, manual, import';
