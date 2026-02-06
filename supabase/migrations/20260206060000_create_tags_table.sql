-- Migration: Add description column to existing tags table
-- This adds AI-generated descriptions to the existing tags infrastructure

-- Add description column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tags' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.tags ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add category column for grouping (mood, theme, style, etc.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tags' AND column_name = 'category'
    ) THEN
        ALTER TABLE public.tags ADD COLUMN category TEXT;
    END IF;
END $$;

-- Update source_type to 'ai' for tags that get AI descriptions
-- (existing tags can be backfilled with descriptions)

COMMENT ON COLUMN public.tags.description IS 'AI-generated description explaining the tag meaning for tooltips';
COMMENT ON COLUMN public.tags.category IS 'Tag category: mood, theme, style, narrative, pacing, tone';
