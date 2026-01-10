-- Enriches the global_items table with more detailed metadata fields for Movies/TV
-- Corresponds to user request for "Item" table enrichment

ALTER TABLE global_items
-- People
ADD COLUMN IF NOT EXISTS "cast" text[],
ADD COLUMN IF NOT EXISTS "director" text,
ADD COLUMN IF NOT EXISTS "writer" text,
ADD COLUMN IF NOT EXISTS "studio" text,
-- Sorting
ADD COLUMN IF NOT EXISTS "genres" text[],
-- release_year already exists in global_items
ADD COLUMN IF NOT EXISTS "content_rating" text,
ADD COLUMN IF NOT EXISTS "runtime" integer,
ADD COLUMN IF NOT EXISTS "vote_average" numeric,
-- Media
ADD COLUMN IF NOT EXISTS "trailer_url" text,
ADD COLUMN IF NOT EXISTS "tagline" text;
