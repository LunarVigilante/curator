-- Migration to add rich metadata columns for Video Games
-- Existing columns to skip: platforms, status, developers, publishers, time_to_beat

DO $$
BEGIN
    -- JSONB Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_items' AND column_name = 'game_engines') THEN
        ALTER TABLE global_items ADD COLUMN game_engines jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_items' AND column_name = 'websites') THEN
        ALTER TABLE global_items ADD COLUMN websites jsonb;
    END IF;

    -- Array Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_items' AND column_name = 'game_modes') THEN
        ALTER TABLE global_items ADD COLUMN game_modes text[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_items' AND column_name = 'perspectives') THEN
        ALTER TABLE global_items ADD COLUMN perspectives text[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_items' AND column_name = 'videos') THEN
        ALTER TABLE global_items ADD COLUMN videos text[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_items' AND column_name = 'screenshots') THEN
        ALTER TABLE global_items ADD COLUMN screenshots text[];
    END IF;

    -- Text/Integer Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_items' AND column_name = 'franchise') THEN
        ALTER TABLE global_items ADD COLUMN franchise text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_items' AND column_name = 'dlc_count') THEN
        ALTER TABLE global_items ADD COLUMN dlc_count integer;
    END IF;

END $$;
