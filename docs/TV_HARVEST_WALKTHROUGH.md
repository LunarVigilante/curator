# TV Show Harvest & Backfill Walkthrough

> **Version**: 8.0 (Exemplar Anchoring + Normalization)  
> **Last Updated**: 2026-02-06

This document describes the complete TV show pipeline with:
- **Hybrid-Relational Schema**: Normalized genres/creatives tables
- **Dual-Lane Indexing**: Janitor (scripts) + Curator (AI discovery)
- **Peer Review**: Semantic neighborhood validation before save
- **Drift Prevention**: Vibe outlier detection (3σ threshold)
- **Exemplar Anchoring**: Curated reference shows calibrate vibe scoring
- **Power Normalization**: Spreads clustered scores for better differentiation

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Column Mapping](#column-mapping)
3. [Dual-Lane Indexing](#dual-lane-indexing)
4. [Peer Review System](#peer-review-system)
5. [Harvest Pipeline](#harvest-pipeline)
6. [Database Schema](#database-schema)
7. [RPC Functions](#rpc-functions)
8. [Tags System](#tags-system)
9. [Vibe Scoring v2](#vibe-scoring-v2)
10. [CLI Reference](#cli-reference)

---

## Architecture Overview

### The Hybrid-Relational Model

```
┌─────────────────────────────────────────────────────────────┐
│                     global_items (233k+)                    │
│  - Core metadata (title, dates, ratings, embeddings)        │
│  - AI columns (bucket_type, franchise_type, vibe_scores)    │
│  - Legacy arrays (genres[], cast[]) for backward compat     │
└─────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐        ┌─────────────────┐
│     genres      │        │    creatives    │
│   (684 rows)    │        │  (225k rows)    │
│  id, name, slug │        │ id, name, slug  │
└────────┬────────┘        └────────┬────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐        ┌─────────────────────────────────┐
│  item_genres    │        │        item_creatives           │
│ (407k junctions)│        │         (100k+ junctions)       │
│ item_id,genre_id│        │ item_id, creative_id, role,     │
│                 │        │ character_name, billing_order   │
└─────────────────┘        └─────────────────────────────────┘
```

---

## Dual-Lane Indexing

### Janitor Lane (Hot Lane)
For scripts to find items needing processing.

```sql
-- Find items missing AI analysis (instant on 233k rows)
CREATE INDEX idx_harvest_queue 
ON global_items (created_at DESC) 
WHERE bucket_type IS NULL OR vibe_scores IS NULL OR vibe_scores = '{}'::jsonb;

-- Find items missing embeddings
CREATE INDEX idx_missing_embeddings 
ON global_items (created_at DESC) 
WHERE embedding IS NULL;
```

### Curator Lane (Discovery Lane)
For AI to compare items against 233k ancestors.

```sql
-- HNSW for millisecond similarity search
CREATE INDEX idx_global_items_embedding 
ON global_items USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

## Peer Review System

### Overview
Before saving, each item undergoes **semantic neighborhood validation**:

1. **Embed**: Generate 1024d vector for new item
2. **Search**: Find 5 closest neighbors from 233k library (HNSW)
3. **Validate**: Check bucket consistency + vibe drift

### Semantic Neighborhood Check
```typescript
// Find 5 closest semantic peers
const { data: neighbors } = await supabase.rpc('find_semantic_neighbors', {
    p_embedding: embeddingVector,
    p_category_type: 'TV_SHOW',
    p_limit: 5
});

// Console output:
// ╔══ SEMANTIC NEIGHBORS ══
// ║ 1. Breaking Bad (dist: 0.142) [NARRATIVE]
// ║ 2. Better Call Saul (dist: 0.187) [NARRATIVE]
// ║ 3. Ozark (dist: 0.203) [NARRATIVE]
// ╚════════════════════════
```

### Drift Prevention (Outlier Detection)
Detects vibe scores >3 standard deviations from category mean.

```typescript
const { data: outliers } = await supabase.rpc('detect_vibe_outliers', {
    p_vibe_scores: vibeScores,
    p_category_type: 'TV_SHOW'
});

// Automatically adds relational tags:
// - high-grit, low-whimsy (for 3σ outliers)
// - extreme-prestige (for 4σ+ outliers)
// - genre-defying (if 3+ outlier dimensions)
```

---

## Harvest Pipeline

### Phase Flow

```
1. FETCH METADATA         ───────────────────────────────────
   fetchTmdbDetails() → fetchOmdbData() → getSeriesExtended()

2. AI CLASSIFICATION      ───────────────────────────────────
   generateTvShowDescription() → 5-part structured description
   generateTags() → 4-bucket taxonomy (15-20 tags)
   generateVibeScores() → 20-dimension vibe profile (with normalization)

3. EMBEDDING              ───────────────────────────────────
   buildEmbeddingText() → generateEmbedding() → 1024d vector

4. PEER REVIEW            ───────────────────────────────────
   find_semantic_neighbors() → 5 closest items (HNSW)
   detect_vibe_outliers() → flag 3σ deviations
   Bucket consistency check

5. SAVE                   ───────────────────────────────────
   UPDATE global_items with all fields
   ⏱️ Per-item timing logged
```

### TVDB Character Data
When TVDB returns no character name, the code falls back to the actor's `personName` to avoid displaying raw `"null"` in the character field.

---

## CLI Reference

| Flag | Effect |
|------|--------|
| `--limit=N` | Process N items only |
| `--dry-run` | Preview without saving |
| `--force` | Force all AI regeneration |
| `--force-desc` | Force description regen |
| `--force-tags` | Force tags regen |
| `--force-embeddings` | Force embedding regen |
| `--force-vibe` | Force vibe scores regen |
| `--exclude-recent=N` | Skip items updated in last N hours |
| `--desc-only` | Only regenerate AI content (skip metadata updates) |
| `--only=MODE` | Progressive enrichment: `vibes`, `tags`, `embeddings`, or `desc` only |
| `--start-at=N` | Skip first N items (positional) |
| `--resume` | Resume from last checkpoint (ID-based, survives query changes) |
| `--update-title` | Allow title updates (risky: unique constraint violations) |

### Example Usage
```bash
# Full reharvest
npx tsx src/scripts/reharvest-tv.ts

# Only add vibe scores (1 LLM call per item instead of 8)
npx tsx src/scripts/reharvest-tv.ts --only=vibes

# Resume after crash (ID-based checkpoint)
npx tsx src/scripts/reharvest-tv.ts --resume

# Reharvest with description-only mode, skip recently updated
npx tsx src/scripts/reharvest-tv.ts --desc-only --exclude-recent=1

# Test on 5 items, dry run
npx tsx src/scripts/reharvest-tv.ts --limit=5 --dry-run
```

---

## Database Schema

### Normalized Tables

```sql
-- Master genre lookup
CREATE TABLE genres (
    id UUID PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
);

-- Genre junction (407k rows)
CREATE TABLE item_genres (
    item_id UUID REFERENCES global_items(id),
    genre_id UUID REFERENCES genres(id),
    PRIMARY KEY (item_id, genre_id)
);

-- Master creatives (225k rows)
CREATE TABLE creatives (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    external_ids JSONB
);

-- Creatives junction with roles
CREATE TABLE item_creatives (
    item_id UUID REFERENCES global_items(id),
    creative_id UUID REFERENCES creatives(id),
    role TEXT NOT NULL,  -- 'actor', 'director', 'writer'
    character_name TEXT,
    billing_order INTEGER,
    PRIMARY KEY (item_id, creative_id, role)
);
```

### Vibe Comparison View

```sql
CREATE VIEW vibe_comparison AS
SELECT 
    id, title, category_type, bucket_type,
    (vibe_scores->>'grit')::float as grit_score,
    (vibe_scores->>'cerebral')::float as cerebral_score,
    (vibe_scores->>'prestige')::float as prestige_score,
    -- ... 17 more dimensions
FROM global_items
WHERE vibe_scores != '{}'::jsonb;
```

---

## RPC Functions

### find_semantic_neighbors
```sql
SELECT * FROM find_semantic_neighbors(
    p_embedding := $vector,
    p_category_type := 'TV_SHOW',
    p_limit := 5
);
-- Returns: id, title, bucket_type, franchise_type, vibe_scores, distance
```

### detect_vibe_outliers
```sql
SELECT * FROM detect_vibe_outliers(
    p_vibe_scores := $vibe_json,
    p_category_type := 'TV_SHOW'
);
-- Returns: dimension, item_score, category_avg, category_stddev, z_score, is_outlier
```

### get_category_vibe_stats
```sql
SELECT * FROM get_category_vibe_stats('TV_SHOW');
-- Returns: dimension, avg_score, stddev_score, count
```

### browse_items
```sql
SELECT * FROM browse_items(
    p_category_type := 'TV_SHOW',
    p_limit := 20,
    p_offset := 0
);
-- Returns: paginated items with filters
-- search_path: public, extensions (for vector ops)
```

---

## Tags System

### Centralized Tags Table
All semantic tags are stored in a centralized `tags` table with AI-generated descriptions:

```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,     -- e.g., 'awkward-cringe-comedy'
    name TEXT NOT NULL,             -- e.g., 'awkward cringe comedy'
    description TEXT,               -- AI-generated tooltip description
    category TEXT                   -- mood, theme, style, narrative, pacing, tone
);
```

### Tag Categories
| Category | Examples |
|----------|----------|
| mood | buoyant, melancholic, tense |
| theme | redemption, family, identity |
| style | documentary, surreal, minimalist |
| narrative | episodic, serialized, anthology |
| pacing | slow-burn, rapid-fire, methodical |
| tone | dark, light-hearted, satirical |

### Tag Flow in Harvest Pipeline
```
┌─────────────────────────────────────────────────────────────┐
│                   generateTags(supabase, ...)               │
│  AI generates semantic tag names from content context       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    ensureTags(supabase, tagNames)           │
│  1. Convert names to slugs                                  │
│  2. Check existing tags in tags table                       │
│  3. Generate AI descriptions for new tags                   │
│  4. Categorize new tags (mood/theme/style/etc)              │
│  5. Insert new tags                                         │
│  6. Return {id, name, slug, description} array              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   cached_tags (global_items)                │
│  Denormalized copy: [{id, name}, ...] for fast retrieval    │
└─────────────────────────────────────────────────────────────┘
```

### Backfill Existing Tags
Run the backfill script to migrate existing cached_tags to the tags table:

```bash
# Preview (dry run)
npx tsx src/scripts/backfill-tags.ts --dry-run

# Execute backfill
npx tsx src/scripts/backfill-tags.ts

# Limit for testing
npx tsx src/scripts/backfill-tags.ts --limit=50
```

### UI Integration
The sidebar uses `useTagDescriptions` hook to fetch descriptions from the tags table:
- Tooltips display AI-generated descriptions on hover
- Falls back to "Semantic tag: {name}" if no description exists

---

## Vibe Scoring v2

### Exemplar Anchoring
Each dimension is calibrated with curated reference shows that define the 1.0 extreme:

| Dimension | 1.0 Anchors |
|-----------|-------------|
| grit | The Wire, The Shield, Generation Kill |
| whimsy | Pushing Daisies, The Good Place, Schmigadoon! |
| cerebral | Westworld S1, Devs, Primer |
| pacing | 24, Bodyguard, Money Heist |
| complexity | Dark, Game of Thrones, The Wire |
| intimacy | In Treatment, The Bear, Fleabag |
| adrenaline | Squid Game, Breaking Bad, Chernobyl |
| aesthetic | Hannibal, Euphoria, Legion |
| melancholy | The Leftovers, Six Feet Under, BoJack Horseman |
| prestige | Twin Peaks: The Return, The Crown, Mad Men |
| nostalgia | Stranger Things, GLOW, Freaks and Geeks |
| surrealism | Atlanta, Twin Peaks, Man Seeking Woman |
| grandiosity | Game of Thrones, Foundation, Rome |
| provocative | Euphoria, Black Mirror, The Boys |
| wholesomeness | Ted Lasso, Schitt's Creek, Great British Bake Off |
| cynicism | Succession, Veep, It's Always Sunny |
| symmetry | Severance, Mr. Robot, Homecoming |
| grind | The Wire, Deadwood, Tinker Tailor Soldier Spy |
| mystery | Lost, Severance, Yellowjackets |
| camp | Riverdale, American Horror Story, True Blood |

### Power Normalization (k=3)
After LLM scoring, a power curve spreads clustered values:

```
Raw → Normalized:
0.9 → 0.82  (high stays high)
0.8 → 0.59  (mid compressed)
0.6 → 0.52  (slightly above neutral)
0.5 → 0.50  (unchanged)
0.3 → 0.42  
0.2 → 0.18  (low stays low)
```

### Vibe Dimensions (20)

| Dimension | Low | High |
|-----------|-----|------|
| grit | Polished | Brutal |
| whimsy | Serious | Playful |
| cerebral | Visceral | Intellectual |
| pacing | Meditative | Frenetic |
| complexity | Simple | Labyrinthine |
| intimacy | Epic | Personal |
| adrenaline | Tranquil | Heart-pounding |
| aesthetic | Utilitarian | Stylized |
| melancholy | Joyful | Sorrowful |
| prestige | Popcorn | Arthouse |
| nostalgia | Modern | Retro |
| surrealism | Realistic | Dreamlike |
| grandiosity | Modest | Operatic |
| provocative | Safe | Transgressive |
| wholesomeness | Nihilistic | Heartfelt |
| cynicism | Idealistic | Jaded |
| symmetry | Chaotic | Precise |
| grind | Accessible | Demanding |
| mystery | Clear | Enigmatic |
| camp | Sincere | Over-the-top |

---

## Cross-Category Queries

### Example: Top Grittiest Items Across All Media
```sql
SELECT title, category_type, grit_score
FROM vibe_comparison
ORDER BY grit_score DESC
LIMIT 10;
```

### Example: Find "Drama" Across All Categories
```sql
SELECT gi.category_type, COUNT(*)
FROM global_items gi
JOIN item_genres ig ON gi.id = ig.item_id
JOIN genres g ON g.id = ig.genre_id
WHERE g.name = 'Drama'
GROUP BY gi.category_type;
-- MOVIE: 27k, TV_SHOW: 8k, ANIME: 2.4k
```

### Example: Bryan Cranston's Work
```sql
SELECT gi.title, gi.category_type
FROM global_items gi
JOIN item_creatives ic ON gi.id = ic.item_id
JOIN creatives c ON c.id = ic.creative_id
WHERE c.name = 'Bryan Cranston';
```
