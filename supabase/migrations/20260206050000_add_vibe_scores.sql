-- Migration: Add vibe_scores JSONB column for cross-category comparison
-- 20 dimensions scored 0.0-1.0 for universal "vibe" matching

-- Add vibe_scores JSONB column
ALTER TABLE public.global_items 
ADD COLUMN IF NOT EXISTS vibe_scores JSONB;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_global_items_vibe_scores 
ON public.global_items USING gin (vibe_scores);

-- Document the schema
COMMENT ON COLUMN public.global_items.vibe_scores IS 
'20-dimension vibe scoring (0.0-1.0): grit, whimsy, cerebral, pacing, complexity, intimacy, adrenaline, aesthetic, melancholy, prestige, nostalgia, surrealism, grandiosity, provocative, wholesomeness, cynicism, symmetry, grind, mystery, camp';
