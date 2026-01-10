-- Anime specific metadata
-- Note: 'source' column already exists for data provenance (e.g. 'anilist'). 
-- using 'source_material' for the "MANGA"/"LIGHT_NOVEL" distinction.

ALTER TABLE global_items
ADD COLUMN IF NOT EXISTS "episodes" integer,
ADD COLUMN IF NOT EXISTS "season" text,
ADD COLUMN IF NOT EXISTS "source_material" text,
ADD COLUMN IF NOT EXISTS "romaji_title" text,
ADD COLUMN IF NOT EXISTS "original_creator" text;
