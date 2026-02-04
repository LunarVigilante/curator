# TV Harvest & Backfill System - Comprehensive Walkthrough

> **Last Updated:** 2026-02-04

This document provides an exhaustive reference for the TV show harvesting, enrichment, and similarity system.

---

## 📁 File Inventory

### Harvesters
| File | Lines | Purpose |
|------|-------|---------|
| [tmdb.ts](file:///d:/Antigravity/v2/curator/src/lib/harvesters/tmdb.ts) | 883 | Unified TMDB harvester for Movies & TV |
| [shared.ts](file:///d:/Antigravity/v2/curator/src/lib/harvesters/shared.ts) | 480 | Common utilities, rate limiting, embedding generation |
| [anime.ts](file:///d:/Antigravity/v2/curator/src/lib/harvesters/anime.ts) | 200 | AniList/MAL anime harvester |
| [board-games.ts](file:///d:/Antigravity/v2/curator/src/lib/harvesters/board-games.ts) | 361 | BoardGameGeek harvester |
| [books.ts](file:///d:/Antigravity/v2/curator/src/lib/harvesters/books.ts) | 171 | Google Books harvester |
| [movies.ts](file:///d:/Antigravity/v2/curator/src/lib/harvesters/movies.ts) | 138 | Legacy TMDB movie-only harvester |
| [music.ts](file:///d:/Antigravity/v2/curator/src/lib/harvesters/music.ts) | 245 | Spotify music harvester |
| [podcasts.ts](file:///d:/Antigravity/v2/curator/src/lib/harvesters/podcasts.ts) | 198 | iTunes podcast harvester |
| [video-games.ts](file:///d:/Antigravity/v2/curator/src/lib/harvesters/video-games.ts) | 163 | RAWG video game harvester |

### AI / Description Generation
| File | Lines | Purpose |
|------|-------|---------|
| [tv-show-description.ts](file:///d:/Antigravity/v2/curator/src/lib/ai/tv-show-description.ts) | 1500 | 3-Bucket strategy, 6-label format, genre lenses, all prompts |
| [franchise-classification.ts](file:///d:/Antigravity/v2/curator/src/lib/ai/franchise-classification.ts) | 353 | Save the Cat franchise classification (8 types) + pilot beats |
| [universe-detection.ts](file:///d:/Antigravity/v2/curator/src/lib/ai/universe-detection.ts) | 320 | Shared universe detection (14 franchises + LLM fallback) |
| [quantization.ts](file:///d:/Antigravity/v2/curator/src/lib/ai/quantization.ts) | 200 | Int8 quantization + Matryoshka truncation utilities |
| [structured-description.ts](file:///d:/Antigravity/v2/curator/src/lib/ai/structured-description.ts) | 251 | Generic 4-part structured descriptions |
| [model-router.ts](file:///d:/Antigravity/v2/curator/src/lib/ai/model-router.ts) | 298 | LLM provider routing (OpenRouter, OpenAI, etc.) |
| [ai-logger.ts](file:///d:/Antigravity/v2/curator/src/lib/ai/ai-logger.ts) | 147 | AI call logging and telemetry |

### Backfill Scripts
| File | Lines | Purpose |
|------|-------|---------|
| [index.ts](file:///d:/Antigravity/v2/curator/src/scripts/backfill/index.ts) | 150 | Main CLI entry point |
| [config.ts](file:///d:/Antigravity/v2/curator/src/scripts/backfill/config.ts) | 48 | Types and configuration |
| [utils.ts](file:///d:/Antigravity/v2/curator/src/scripts/backfill/utils.ts) | 33 | Utility functions |
| [smart.ts](file:///d:/Antigravity/v2/curator/src/scripts/backfill/phases/smart.ts) | 261 | Intelligent conditional updates |
| [rehydrate.ts](file:///d:/Antigravity/v2/curator/src/scripts/backfill/phases/rehydrate.ts) | 225 | Fresh TMDB metadata refresh |
| [descriptions.ts](file:///d:/Antigravity/v2/curator/src/scripts/backfill/phases/descriptions.ts) | 94 | Description regeneration |
| [embeddings.ts](file:///d:/Antigravity/v2/curator/src/scripts/backfill/phases/embeddings.ts) | 55 | Embedding regeneration |
| [metadata.ts](file:///d:/Antigravity/v2/curator/src/scripts/backfill/phases/metadata.ts) | 67 | Metadata refresh |
| [tags.ts](file:///d:/Antigravity/v2/curator/src/scripts/backfill/phases/tags.ts) | 60 | Tag regeneration |

### Similarity System
| File | Lines | Purpose |
|------|-------|---------|
| [similarity-explanations.ts](file:///d:/Antigravity/v2/curator/src/lib/actions/similarity-explanations.ts) | 437 | LLM-powered similarity explanations |
| [search.ts](file:///d:/Antigravity/v2/curator/src/lib/services/search.ts) | 620 | Vector similarity + RRF hybrid + cross-encoder re-ranking |

### Enrichment Services
| File | Lines | Purpose |
|------|-------|---------|
| [TMDBProvider.ts](file:///d:/Antigravity/v2/curator/src/lib/services/enrichment/providers/TMDBProvider.ts) | 417 | TMDB API integration for enrichment |
| [AIEnrichmentService.ts](file:///d:/Antigravity/v2/curator/src/lib/services/enrichment/AIEnrichmentService.ts) | 218 | AI description service |
| [EnrichmentPipeline.ts](file:///d:/Antigravity/v2/curator/src/lib/services/enrichment/EnrichmentPipeline.ts) | 210 | Multi-stage enrichment orchestration |
| [tv-show.ts](file:///d:/Antigravity/v2/curator/src/lib/enrichment/categories/tv-show.ts) | 124 | TV-specific enrichment barrel export |

---

## 🌐 External API Calls

### TMDB API
| Endpoint | Purpose | Rate Limit |
|----------|---------|------------|
| `GET /discover/{type}` | Discover movies/TV by year | 40 req/10s |
| `GET /{type}/{id}?append_to_response=...` | Full details with credits, videos, images, keywords, watch providers | 40 req/10s |
| `GET /tv/changes` | Delta sync - changed TV shows in time range | 40 req/10s |
| `GET /tv/{id}/changes` | What changed on specific TV show | 40 req/10s |

**Append parameters:** `credits,videos,images,external_ids,keywords,watch/providers,recommendations,content_ratings`

### OMDb API
| Endpoint | Purpose |
|----------|---------|
| `GET /?i={imdb_id}&tomatoes=true` | IMDB/RT/Metacritic ratings, awards |
| `GET /?t={title}&y={year}&tomatoes=true` | Fallback by title when no IMDB ID |

### Voyage AI (Embeddings)
| Endpoint | Model | Dimensions |
|----------|-------|------------|
| `POST /v1/embeddings` | `voyage-4` | 1024 |

---

## 🗄️ Database Schema (global_items)

### Core Fields
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `external_id` | text | Source identifier (TMDB ID) |
| `source` | text | Data source (e.g., "tmdb") |
| `title` | text | Display title |
| `description` | text | AI-generated description |
| `image_url` | text | Processed poster URL |
| `category_type` | text | TV_SHOW, MOVIE, etc. |

### TV-Specific Fields
| Column | Type | Description |
|--------|------|-------------|
| `bucket_type` | text | NARRATIVE, FORMAT, OBSERVATIONAL |
| `format_type` | text | 6-label format (SCRIPTED_SINGLE_CAM, etc.) |
| `genre_lens` | text | SCI_FI_FANTASY, CRIME_THRILLER, etc. |
| `franchise_type` | text | Save the Cat type (8 types) |
| `archetypes` | text | Character archetype summary |
| `is_anthology` | boolean | Anthology series flag |
| `pilot_beats` | jsonb | Pilot episode beat sheet |
| `semantic_hash` | text | Hash for change detection |

### Ratings & Aggregates
| Column | Type | Description |
|--------|------|-------------|
| `vote_average` | numeric | TMDB score (0-10) |
| `vote_count` | integer | TMDB vote count |
| `imdb_rating` | numeric | IMDB score (0-10) |
| `imdb_votes` | integer | IMDB vote count |
| `rotten_tomatoes_rating` | integer | RT critic score (0-100) |
| `metacritic_rating` | integer | Metacritic score (0-100) |
| `awards_text` | text | Awards string from OMDb |
| `popularity` | integer | TMDB popularity score |

### Metadata
| Column | Type | Description |
|--------|------|-------------|
| `release_year` | integer | First air year |
| `runtime` | integer | Episode runtime (minutes) |
| `content_rating` | text | TV-MA, TV-14, etc. |
| `status` | text | Returning Series, Ended, etc. |
| `genres` | text[] | Genre array |
| `keywords` | text[] | TMDB keywords |
| `cast` | text[] | Top 10 cast names |
| `director` | text | Primary director |
| `writer` | text | Primary writer(s) |
| `studio` | text | Main production company |
| `networks` | text[] | Broadcasting networks |
| `number_of_seasons` | integer | Season count |
| `number_of_episodes` | integer | Total episodes |

### Vector Search
| Column | Type | Description |
|--------|------|-------------|
| `embedding` | vector(1024) | Voyage-4 embedding |
| `vector_text` | text | Text used to generate embedding |
| `search_vector` | tsvector | BM25 full-text search |

### Structured Description
| Column | Type | Description |
|--------|------|-------------|
| `description_parts` | jsonb | { premise, themes, tone, style, semanticSummary } |
| `cached_tags` | jsonb | Array of { id, name } tag objects |

### Timestamps & Lifecycle
| Column | Type | Description |
|--------|------|-------------|
| `created_at` | timestamptz | Initial creation |
| `last_metadata_update` | timestamptz | Last metadata refresh |
| `last_rehydrated_at` | timestamptz | Last full rehydration |
| `rehydration_priority` | text | Priority for rehydration queue |
| `lifecycle_state` | text | ACTIVE, ARCHIVED, etc. |

---

## 🏷️ Classification Systems

### 3-Bucket Detection (TvBucket)
```
detectTvBucket(genres, keywords, synopsis, tmdbType) → TvBucket
```

| Bucket | Description | Examples |
|--------|-------------|----------|
| **NARRATIVE** | Scripted shows driven by plot & character | Breaking Bad, The Office, Game of Thrones |
| **FORMAT** | Competition/rules-based shows | Survivor, The Voice, Jeopardy |
| **OBSERVATIONAL** | Documentary/docu-reality | Planet Earth, Real Housewives, Making a Murderer |

### 6-Label Format Taxonomy (TvFormat)
```
detectTvFormat(bucket, genres, keywords, synopsis, tmdbType) → TvFormat
```

| Format | Description |
|--------|-------------|
| `SCRIPTED_SINGLE_CAM` | Cinematic, no laugh track (The Bear, Succession) |
| `SCRIPTED_MULTI_CAM` | Stage-like, laugh track (Friends, Big Bang Theory) |
| `SCRIPTED_MOCKUMENTARY` | Fictional documentary style (The Office, Abbott Elementary) |
| `UNSCRIPTED_COMPETITION` | Game mechanics, elimination (Survivor, Top Chef) |
| `UNSCRIPTED_DOCUSOAP` | Constructed reality, interpersonal (Real Housewives) |
| `UNSCRIPTED_DOCUSERIES` | Educational, archival (Planet Earth) |

### Genre Lens (GenreLens)
```
detectGenreLens(genres, keywords) → GenreLens
```

| Lens | Genres Captured |
|------|-----------------|
| `SCI_FI_FANTASY` | Sci-Fi, Fantasy, Superhero, Horror |
| `CRIME_THRILLER` | Crime, Mystery, Thriller, Legal |
| `DRAMA_ROMANCE` | Drama, Romance, Family, Period |
| `COMEDY` | Comedy, Sitcom, Satire |
| `GENERAL` | Western, Variety, Unclassified |

### Franchise Classification ("Save the Cat")
```
classifyFranchiseType(llmConfig, title, overview) → FranchiseType
```

| Franchise | Engine | Examples |
|-----------|--------|----------|
| `MONSTER_IN_THE_HOUSE` | Containment + Monster | Walking Dead, Stranger Things |
| `GOLDEN_FLEECE` | Quest + Team | Breaking Bad, Game of Thrones |
| `OUT_OF_THE_BOTTLE` | Magic/Tech + Rules | Black Mirror, Westworld |
| `DUDE_WITH_A_PROBLEM` | Ordinary Hero + Crisis | 24, Prison Break |
| `RITES_OF_PASSAGE` | Life Stage + Growth | Euphoria, Friday Night Lights |
| `BUDDY_LOVE` | Relationship + Obstacle | Ted Lasso, Gilmore Girls |
| `WHYDUNIT` | Mystery + Investigation | True Detective, Mindhunter |
| `FOOL_TRIUMPHANT` | Underdog + Institution | The Office, Schitt's Creek |

### Shared Universe Detection
```
detectSharedUniverse(title, synopsis, networks, keywords, cast, llmConfig?) → UniverseMatch | null
```

| Universe | Slug | Example Shows |
|----------|------|---------------|
| Arrowverse | `arrowverse` | Arrow, The Flash, Supergirl |
| Chicago Franchise | `chicago-verse` | Chicago Fire, Chicago P.D., Chicago Med |
| Law & Order | `law-order-universe` | SVU, Organized Crime |
| Star Trek | `star-trek` | Discovery, Strange New Worlds, Picard |
| Walking Dead | `walking-dead` | TWD, Fear, Daryl Dixon |
| Breaking Bad | `breaking-bad` | Breaking Bad, Better Call Saul |
| Game of Thrones | `game-of-thrones` | GoT, House of the Dragon |
| Yellowstone | `yellowstone-verse` | Yellowstone, 1883, 1923 |
| NCIS | `ncis-verse` | NCIS, LA, Hawai'i |
| Grey's Anatomy | `greys-verse` | Grey's, Station 19 |
| MCU TV | `mcu-tv` | Loki, WandaVision |
| CSI | `csi-verse` | CSI, Miami, Vegas |
| FBI | `fbi-verse` | FBI, Most Wanted, International |

---

## 🛠️ LLM Prompts

### Archetype Translation
```
translateToArchetypes(config, title, synopsis, castWithCharacters) → string
```

**System Prompt:**
> You are a narrative analyst. Map TV show characters to universal archetypes.
> Output a SINGLE sentence (max 40 words) describing the main character dynamics using archetype labels.
> Format: "Features [archetype] protagonist who [function], balanced by [archetype] who [function]."

**Available Archetypes:**
- Anti-Hero, Byronic Hero, Everyman, The Mentor, The Sage
- The Trickster, The Herald, The Threshold Guardian
- The Shapeshifter, The Shadow, The Ally

---

### Premise Prompts (Per Bucket + Lens)

#### NARRATIVE - Sci-Fi/Fantasy
> Write a high-density, spoiler-free premise for this sci-fi/fantasy series.
> - THE SETTING: 5-10 word phrase establishing era, world-state, atmosphere
> - THE CONCEIT: Unique laws of this world (supernatural/tech/magic system)
> - THE PROTAGONIST: Name + compound archetype
> - THE CONFLICT: Existential threat or prophecy

#### NARRATIVE - Crime/Thriller
> Write a high-density, spoiler-free premise for this crime/thriller series.
> - THE SETTING: 5-10 word phrase establishing location and atmosphere
> - THE INCITING CRIME: Specific crime/case driving the series
> - THE INVESTIGATOR: Name + unique angle/flaw
> - THE STAKES: What happens if they fail?

#### NARRATIVE - Drama/Romance
> Write a high-density, spoiler-free premise for this drama/romance series.
> - THE SETTING: Emotional temperature phrase
> - THE FRICTION: Core emotional wound/social barrier
> - THE PROTAGONIST: Name + internal conflict
> - THE QUESTION: What must they choose/sacrifice?

#### NARRATIVE - Comedy
> Write a high-density, spoiler-free premise for this comedy series.
> - THE SETTING: Comedic world phrase
> - THE SETUP: Core comedic engine (fish out of water, etc.)
> - THE PROTAGONIST: Name + comedic archetype
> - THE FORMULA: Recurring comedic beats

#### FORMAT (Competition)
> You are a TV format analyst.
> - THE ENGINE: Define the format (singing competition, baking gauntlet)
> - THE MECHANICS: Rules - what do participants physically do?
> - THE STAKES: Win condition (cash prize, trophy)
> - THE VIBE: Cutthroat vs wholesome

#### OBSERVATIONAL (Documentary)
> You are a social historian and documentary curator.
> - THE SUBJECT: Specific topic/subculture being investigated
> - THE LENS: Core question (documentary) or interpersonal dynamics (docu-soap)
> - THE KEY FIGURES: Subjects/archetypes
> - THE ACCESS: What makes this unique?

---

### Themes Prompt
> You are a Cultural Taxonomist. Identify the core narrative DNA.
> 
> PART 1: 2-3 sentence insight explaining how themes are used
> PART 2: 6-8 standardized tags (Macro Themes + Micro Tropes)
> Format: **Keywords:** [Tag 1], [Tag 2]...

---

### Tone Prompt
> You are a "Vibe" Curator. Construct emotional profile.
>
> 1. THE ATMOSPHERE: 3 high-precision adjectives
> 2. THE EXPERIENCE: Emotional aftertaste sentence
> 3. VECTOR TRIANGULATION: 3 "For Fans Of" anchors with WHY
> 4. TARGET AUDIENCE: Specific niche tribe

---

### Style Prompt
> You are a Production Analyst. Describe audio-visual identity.
>
> 1. THE VISUAL AESTHETIC: Camera work, color grading
> 2. THE AUDIO & PACING: Sound design, editing rhythm
> 3. PRODUCTION TAGS: 3-5 technical keywords

---

### Similarity Explanation Prompt
```
getSimilarityExplanation(sourceItemId, similarItemId) → SimilarityExplanation
```

**System Prompt:**
> You are an expert at analyzing media similarities. Return JSON:
> ```json
> {
>   "summary": "1-2 sentences explaining shared themes/tones/appeal",
>   "sharedDNA": ["Theme 1", "Theme 2", "Theme 3"],
>   "keyDifference": "1 sentence noting key difference (or null)"
> }
> ```

**User Prompt includes:**
- Title, Year, Category, Genres, Tags, Rating, Description (truncated to context limit)

---

## 🔄 Harvest/Backfill Pipeline

### CLI Commands
```bash
# Harvest new TV shows (discovery mode)
npx tsx src/scripts/harvest-tmdb.ts --type=tv --operation=harvest

# Smart backfill (conditional updates)
npx tsx src/scripts/backfill/index.ts --category=TV_SHOW --phase=smart

# Rehydrate (fresh TMDB metadata)
npx tsx src/scripts/backfill/index.ts --category=TV_SHOW --phase=rehydrate

# Bulk export (daily cron)
npx tsx src/scripts/harvest-bulk-export.ts

# Delta sync (hourly cron)
npx tsx src/scripts/sync-changes.ts
```

### Smart Phase Checks
1. **Missing metadata** → Refresh from TMDB/OMDb
2. **Incomplete description_parts** → Regenerate via LLM
3. **Missing tags** → Generate via LLM
4. **Missing search_vector** → Trigger tsvector backfill
5. **Any updates** → Regenerate embedding

### Rehydration Priority
| Status | Interval |
|--------|----------|
| Returning Series | Weekly |
| In Production | Monthly |
| Planned | Monthly |
| Ended | Quarterly |
| Canceled | Quarterly |

---

## 🔍 Similarity Search

### Vector Similarity (cosine distance)
```sql
SELECT * FROM global_items
ORDER BY embedding <=> $query_embedding
LIMIT 20;
```

### Hybrid Search (RRF Fusion)
```sql
SELECT * FROM hybrid_search_rrf(
  query_text := 'dark comedy family drama',
  query_embedding := $vector,
  match_count := 20,
  category_filter := 'TV_SHOW',
  rrf_k := 60
);
```

### RRF Formula
```
score = 1/(k + keyword_rank) + 1/(k + vector_rank)
```
Where k=60 balances keyword and semantic relevance.

---

## 🎨 UI Components (TV Show Detail)

The `ItemDetailView` component displays:

1. **Header**: Title, Year, Status badge, Content Rating
2. **Poster**: Optimized WebP image
3. **Ratings Grid**: IMDB, RT, Metacritic aggregation
4. **Awards Banner**: Oscar/Emmy highlights
5. **Description**: AI-generated (premise + themes + tone)
6. **Metadata**: Cast, Director, Writers, Studio, Networks
7. **Tags**: Semantic tags from 4-bucket taxonomy
8. **Related Items**: Vector similarity recommendations with:
   - Similarity score
   - Shared DNA tooltip (on hover)
   - Key difference (if applicable)
9. **Trailer**: Embedded YouTube player
10. **Watch Providers**: Streaming availability

---

## 📊 Embedding Super-Document Template

The embedding text follows a labeled section format for Voyage-4's attention mechanism:

```
Title: {title}
Genre: {genres}
Franchise Type: {franchiseType}
Format: {formatType}
Bucket: {bucketType}
Archetypes: {archetypes}
Year: {release_year}
Semantic Summary: {semanticSummary}
Themes: {themes}
Keywords: {keywords}
Tags: {subGenres}, {tropes}, {mood}, {format}
```

**Token Limit:** 1024 tokens (per Voyage-4 optimal range)

---

## 🗃️ Supporting Tables

### similarity_explanations
| Column | Type | Description |
|--------|------|-------------|
| source_item_id | uuid | Source item FK |
| similar_item_id | uuid | Similar item FK |
| summary | text | 1-2 sentence explanation |
| shared_dna | jsonb | Array of thematic tags |
| key_difference | text | Primary difference (nullable) |
| created_at | timestamptz | Generation timestamp |

### tags
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Tag display name |
| slug | text | URL-safe identifier |
| category | text | Tag category (genre, mood, etc.) |

---

## ⚡ Performance Optimizations

1. **Matryoshka Indexing**: 512d HNSW index on first half of 1024d vectors
2. **GIN Index**: Full-text search on `search_vector` column
3. **Batch Processing**: 100 items per query batch
4. **Rate Limiting**: p-limit with configurable concurrency
5. **Semantic Hash**: SHA-256 of key fields for change detection
6. **Caching**: Similarity explanations cached in database

### Cross-Encoder Re-Ranking (NEW)
```typescript
const results = await searchItems(query, {
    rerank: true,           // Enable cross-encoder re-ranking
    rerankCandidates: 50,   // Fetch 50 candidates, rerank to limit
    limit: 20
});
```

Uses Voyage `rerank-2` cross-encoder for higher precision on top results.

### int8 Quantization (NEW)
```typescript
import { quantizeEmbedding, compressEmbedding } from '@/lib/ai/quantization';

// Quantize full 1024d embedding
const quantized = quantizeEmbedding(embedding);  // 4x storage reduction

// Matryoshka + Quantization (8x reduction)
const compressed = compressEmbedding(embedding, 512);  // 512d int8
```

| Mode | Dimensions | Bytes | Savings |
|------|------------|-------|---------|
| Full float32 | 1024 | 4,096 | - |
| Matryoshka float32 | 512 | 2,048 | 50% |
| int8 quantized | 1024 | ~1,044 | 75% |
| Matryoshka + int8 | 512 | ~532 | 87% |

---

*Generated automatically from codebase analysis. Last updated: 2026-02-04*

