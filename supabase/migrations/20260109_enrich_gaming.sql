-- Gaming specific metadata

ALTER TABLE global_items
ADD COLUMN IF NOT EXISTS "platforms" text[],
ADD COLUMN IF NOT EXISTS "developers" text[],
ADD COLUMN IF NOT EXISTS "publishers" text[],
ADD COLUMN IF NOT EXISTS "playtime" integer,    -- Average hours to beat
ADD COLUMN IF NOT EXISTS "metacritic" integer;  -- Score 0-100
