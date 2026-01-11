-- Add missing BGG columns
ALTER TABLE global_items 
ADD COLUMN IF NOT EXISTS families TEXT[],
ADD COLUMN IF NOT EXISTS rank_overall INTEGER,
ADD COLUMN IF NOT EXISTS best_players TEXT,
ADD COLUMN IF NOT EXISTS min_age_community INTEGER,
ADD COLUMN IF NOT EXISTS language_dependence TEXT;
