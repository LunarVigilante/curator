-- ============================================================================
-- MovieLabs Creative Works Ontology Support
-- ============================================================================
-- Adds columns for EIDR identifiers, shared universes, source material tracking,
-- and spinoff relationships per the Semantic Media Intelligence Blueprint.

-- Entertainment Identifier Registry - global unique media identifier
ALTER TABLE global_items 
ADD COLUMN IF NOT EXISTS eidr_id TEXT;

CREATE INDEX IF NOT EXISTS idx_global_items_eidr ON global_items(eidr_id) WHERE eidr_id IS NOT NULL;

COMMENT ON COLUMN global_items.eidr_id IS 
    'EIDR (Entertainment Identifier Registry) canonical ID for cross-platform resolution';

-- ============================================================================
-- Shared Universes Table
-- ============================================================================
-- Tracks connected universes (Arrowverse, Chicago-verse, Star Trek, MCU, etc.)

CREATE TABLE IF NOT EXISTS tv_universes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    flagship_series_id UUID REFERENCES global_items(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE tv_universes IS 
    'Shared narrative universes connecting multiple TV series (e.g., Arrowverse, Chicago franchise)';

-- Add universe reference to global_items
ALTER TABLE global_items 
ADD COLUMN IF NOT EXISTS universe_id UUID REFERENCES tv_universes(id);

CREATE INDEX IF NOT EXISTS idx_global_items_universe ON global_items(universe_id) WHERE universe_id IS NOT NULL;

COMMENT ON COLUMN global_items.universe_id IS 
    'FK to shared narrative universe (connectedUniverse relationship)';

-- ============================================================================
-- Source Material Tracking (isBasedOn relationship)
-- ============================================================================
-- Tracks what the show is adapted from (book, comic, video game, true story, etc.)

ALTER TABLE global_items 
ADD COLUMN IF NOT EXISTS source_material JSONB;

COMMENT ON COLUMN global_items.source_material IS 
    'Source material metadata: { type: "NOVEL"|"COMIC"|"VIDEO_GAME"|"TRUE_STORY"|"FILM", title, author, year }';

-- ============================================================================
-- Spinoff/Derivative Tracking (parent_series_id)
-- ============================================================================

ALTER TABLE global_items 
ADD COLUMN IF NOT EXISTS parent_series_id UUID REFERENCES global_items(id);

CREATE INDEX IF NOT EXISTS idx_global_items_parent_series ON global_items(parent_series_id) WHERE parent_series_id IS NOT NULL;

COMMENT ON COLUMN global_items.parent_series_id IS 
    'FK to parent series for spinoffs (e.g., Better Call Saul -> Breaking Bad)';

-- ============================================================================
-- Seed Known Universes
-- ============================================================================

INSERT INTO tv_universes (name, slug, description) VALUES
    ('Arrowverse', 'arrowverse', 'DC superhero universe spanning Arrow, The Flash, Supergirl, Legends of Tomorrow'),
    ('Chicago Franchise', 'chicago-verse', 'Dick Wolf''s Chicago universe: Chicago Fire, PD, Med, Justice'),
    ('Law & Order Universe', 'law-order-universe', 'Dick Wolf''s Law & Order franchise including SVU, Organized Crime'),
    ('Star Trek Universe', 'star-trek', 'CBS/Paramount Star Trek franchise spanning TOS through Strange New Worlds'),
    ('The Walking Dead Universe', 'walking-dead', 'AMC Walking Dead franchise including Fear, World Beyond, Tales'),
    ('Breaking Bad Universe', 'breaking-bad', 'Vince Gilligan''s Breaking Bad and Better Call Saul'),
    ('Game of Thrones Universe', 'game-of-thrones', 'HBO ASOIAF universe including House of the Dragon'),
    ('Yellowstone Universe', 'yellowstone-verse', 'Taylor Sheridan''s Yellowstone and prequels 1883, 1923'),
    ('NCIS Universe', 'ncis-verse', 'CBS NCIS franchise including LA, New Orleans, Hawaii, Sydney'),
    ('Grey''s Anatomy Universe', 'greys-verse', 'Shondaland medical universe including Station 19, Private Practice')
ON CONFLICT (slug) DO NOTHING;
