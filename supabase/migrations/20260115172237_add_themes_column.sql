-- Add themes column to global_items table
-- This column stores thematic elements for content items (e.g., "coming of age", "redemption", "friendship")

ALTER TABLE public.global_items 
ADD COLUMN IF NOT EXISTS themes TEXT[];

-- Add a comment for documentation
COMMENT ON COLUMN public.global_items.themes IS 'Array of thematic elements for the content (e.g., coming of age, redemption, friendship)';
