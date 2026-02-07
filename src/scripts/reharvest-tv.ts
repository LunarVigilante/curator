#!/usr/bin/env npx tsx
/**
 * TV Show Reharvest Script
 * 
 * Re-harvests ALL existing TV shows from the library without searching for new ones.
 * This runs the full enrichment pipeline on each item:
 * - Fetches fresh TMDB data (credits, keywords, etc.)
 * - Fetches OMDb ratings (IMDB, RT, Metacritic)
 * - Regenerates descriptions if missing
 * - Regenerates tags if missing
 * - Regenerates embeddings if missing
 * - Updates all metadata fields
 * 
 * Usage:
 *   npx tsx src/scripts/reharvest-tv.ts                  # Run full reharvest
 *   npx tsx src/scripts/reharvest-tv.ts --limit=50       # Limit to 50 items
 *   npx tsx src/scripts/reharvest-tv.ts --dry-run        # Preview without saving
 *   npx tsx src/scripts/reharvest-tv.ts --force          # Force regen descriptions/tags/embeddings
 *   npx tsx src/scripts/reharvest-tv.ts --desc-only      # Only regenerate descriptions (skip metadata)
 *   npx tsx src/scripts/reharvest-tv.ts --start-at=100   # Start at item N (positional)
 *   npx tsx src/scripts/reharvest-tv.ts --resume         # Resume from last checkpoint (ID-based)
 *   npx tsx src/scripts/reharvest-tv.ts --only=vibes     # Progressive: only regenerate vibe scores
 *   npx tsx src/scripts/reharvest-tv.ts --exclude-recent=1  # Skip items updated in last N hours
 */

import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { generateEmbedding, generateTags, ensureTags, sleep, aiLimiter, getLLMConfig, computeSemanticHash, hasSemanticChanges } from '@/lib/harvesters/shared';
import { combineDescription, buildEmbeddingText, type StructuredDescription } from '@/lib/ai/structured-description';
import fs from 'fs';
import path from 'path';
import { generateTvShowDescription } from '@/lib/ai/tv-show-description';
import { generateVibeScores, type VibeScores } from '@/lib/ai/vibe-scoring';
import { getSeriesExtended, type TvdbEnrichmentResult } from '@/lib/services/tvdb';
import { extractEnrichment, isAnime, detectUniverseFromOfficialLists } from '@/lib/services/tvdb-utils';
import pLimit from 'p-limit';

// ============================================================================
// CONFIG
// ============================================================================

const CONCURRENCY = 1;  // Reduced from 5 to avoid LLM rate limiting
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const OMDB_BASE_URL = 'https://www.omdbapi.com';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const TVDB_API_KEY = process.env.TVDB_API_KEY;
const TVDB_PIN = process.env.TVDB_PIN;

// CLI Args
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
const ITEM_LIMIT = limitArg ? parseInt(limitArg, 10) : null;
const DRY_RUN = args.includes('--dry-run');
const FORCE_REGEN = args.includes('--force');
const FORCE_DESC = args.includes('--force-desc') || FORCE_REGEN;
const FORCE_TAGS = args.includes('--force-tags') || FORCE_REGEN;
const FORCE_EMBEDDINGS = args.includes('--force-embeddings') || FORCE_REGEN;
const EXCLUDE_RECENT_ARG = args.find(a => a.startsWith('--exclude-recent='));
const EXCLUDE_RECENT_HOURS = EXCLUDE_RECENT_ARG ? parseInt(EXCLUDE_RECENT_ARG.split('=')[1], 10) : null;
const DESC_ONLY = args.includes('--desc-only'); // Skip metadata updates, only regenerate descriptions
const FORCE_VIBE = args.includes('--force-vibe') || FORCE_REGEN; // Force regenerate vibe scores
const START_AT_ARG = args.find(a => a.startsWith('--start-at='));
const START_AT = START_AT_ARG ? parseInt(START_AT_ARG.split('=')[1], 10) : 0;

// Progressive enrichment: only run specific phases
const ONLY_ARG = args.find(a => a.startsWith('--only='));
const ONLY_MODE = ONLY_ARG ? ONLY_ARG.split('=')[1] : null; // vibes|tags|embeddings|desc

// Checkpoint/resume support
const CHECKPOINT_FILE = path.join(process.cwd(), '.reharvest-checkpoint.json');
const RESUME = args.includes('--resume');

interface Checkpoint {
    lastItemId: string;
    lastItemTitle: string;
    processedCount: number;
    timestamp: string;
}

function writeCheckpoint(itemId: string, title: string, count: number): void {
    const checkpoint: Checkpoint = {
        lastItemId: itemId,
        lastItemTitle: title,
        processedCount: count,
        timestamp: new Date().toISOString()
    };
    try {
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    } catch { /* best-effort */ }
}

function readCheckpoint(): Checkpoint | null {
    try {
        if (fs.existsSync(CHECKPOINT_FILE)) {
            return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
        }
    } catch { /* corrupted checkpoint */ }
    return null;
}

if (!TMDB_API_KEY) {
    console.error('❌ Missing TMDB_API_KEY');
    process.exit(1);
}

if (!OMDB_API_KEY) {
    console.warn('⚠️  Missing OMDB_API_KEY. Ratings will be skipped.');
}

if (!TVDB_API_KEY) {
    console.warn('⚠️  Missing TVDB_API_KEY. TVDB enrichment will be skipped.');
}

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// Stats
let processedCount = 0;
let successCount = 0;
let errorCount = 0;
let skippedCount = 0;

// ============================================================================
// HELPERS
// ============================================================================

async function fetchTmdbDetails(tmdbId: number) {
    const append = 'credits,videos,images,external_ids,keywords,watch/providers,recommendations,content_ratings';
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=${append}`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited. Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDetails(tmdbId);
        }
        if (res.status === 404) return null;
        throw new Error(`TMDB Fetch Error ${res.status}`);
    }
    return await res.json();
}

async function fetchOmdbData(imdbId: string) {
    if (!OMDB_API_KEY || !imdbId) return null;

    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&i=${imdbId}&tomatoes=true`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.Response === 'False') return null;

        let rtScore: number | null = null;
        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
        if (rtSource?.Value) {
            rtScore = parseInt(rtSource.Value.replace('%', ''), 10);
        }

        return {
            imdb_rating: data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
            imdb_votes: data.imdbVotes ? parseInt(data.imdbVotes.replace(/,/g, ''), 10) : null,
            rotten_tomatoes_rating: rtScore,
            metacritic_rating: data.Metascore && data.Metascore !== 'N/A' ? parseInt(data.Metascore, 10) : null,
            awards: data.Awards && data.Awards !== 'N/A' ? data.Awards : null,
            rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : null,
            writer: data.Writer && data.Writer !== 'N/A' ? data.Writer : null,
        };
    } catch {
        return null;
    }
}

function extractMetadata(details: any) {
    const cast = details.credits?.cast?.slice(0, 10).map((c: any) => c.name) || [];
    const crew = details.credits?.crew || [];
    const director = crew.find((c: any) => c.job === 'Director')?.name || null;
    const createdBy = details.created_by?.map((c: any) => c.name) || [];
    const writers = crew.filter((c: any) => ['Screenplay', 'Writer', 'Story'].includes(c.job)).map((c: any) => c.name);
    const tmdbWriter = [...new Set(writers)].slice(0, 3).join(', ') || null;
    const studios = details.production_companies?.map((c: any) => c.name) || [];
    const mainStudio = studios[0] || null;

    const usRating = details.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US');
    const tmdbRating = usRating?.rating || null;

    const videos = details.videos?.results || [];
    const trailer = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
    const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

    const backdropPath = details.images?.backdrops?.[0]?.file_path || null;
    const logoPath = details.images?.logos?.find((l: any) => l.iso_639_1 === 'en')?.file_path || null;
    const keywords = details.keywords?.results?.map((k: any) => k.name) || [];
    const socials = details.external_ids || {};

    return {
        title: details.name,
        original_title: details.original_name,
        overview: details.overview,
        tagline: details.tagline || null,
        release_date: details.first_air_date,
        release_year: details.first_air_date ? new Date(details.first_air_date).getFullYear() : null,
        status: details.status,
        homepage: details.homepage,
        poster_path: details.poster_path,
        backdrop_path: backdropPath,
        logo_path: logoPath,
        trailer_url: trailerUrl,
        popularity: details.popularity,
        vote_average: details.vote_average,
        vote_count: details.vote_count,
        runtime: details.episode_run_time?.length ? details.episode_run_time[0] : null,
        content_rating: tmdbRating,
        writer: tmdbWriter,
        genres: details.genres?.map((g: any) => g.name) || [],
        keywords: keywords,
        original_language: details.original_language,
        origin_countries: details.origin_country || [],
        cast: cast,
        director: director,
        studio: mainStudio,
        production_companies: studios,
        networks: details.networks?.map((n: any) => n.name) || [],
        number_of_seasons: details.number_of_seasons || null,
        number_of_episodes: details.number_of_episodes || null,
        external_ids: {
            imdb: socials.imdb_id,
            tmdb: details.id,
            tvdb: socials.tvdb_id,
            wikidata: socials.wikidata_id,
        },
        watch_providers: details['watch/providers']?.results?.US || null,
        metadata: {
            created_by: createdBy,
            episode_run_time: details.episode_run_time || [],
            type: details.type || null,
            first_air_date: details.first_air_date || null,
            last_air_date: details.last_air_date || null,
            last_episode_to_air: details.last_episode_to_air ? {
                name: details.last_episode_to_air.name,
                episode_number: details.last_episode_to_air.episode_number,
                season_number: details.last_episode_to_air.season_number,
                air_date: details.last_episode_to_air.air_date,
            } : null,
            next_episode_to_air: details.next_episode_to_air ? {
                name: details.next_episode_to_air.name,
                episode_number: details.next_episode_to_air.episode_number,
                season_number: details.next_episode_to_air.season_number,
                air_date: details.next_episode_to_air.air_date,
            } : null,
        },
    };
}

async function processItem(item: any) {
    const tmdbId = item.external_ids?.tmdb || item.external_ids?.tmdb_tv;

    if (!tmdbId) {
        console.log(`   ⏭️  Skipping ${item.title} - No TMDB ID`);
        skippedCount++;
        return;
    }

    processedCount++;
    const itemStartTime = Date.now();
    console.log(`\n   ╔════════════════════════════════════════════════════════════════`);
    console.log(`   ║ 📺 ${processedCount}. ${item.title}`);
    console.log(`   ╠════════════════════════════════════════════════════════════════`);
    console.log(`   ║ TMDB ID: ${tmdbId} | UUID: ${item.id.slice(0, 8)}...`);

    try {
        // 1. Fetch fresh TMDB data (must come first — provides IMDB/TVDB IDs)
        console.log(`   ║ 🔄 Fetching TMDB data...`);
        const details = await fetchTmdbDetails(Number(tmdbId));
        if (!details) {
            console.log(`   ║ ⚠️  Not found on TMDB`);
            skippedCount++;
            return;
        }

        const meta = extractMetadata(details);
        console.log(`   ║    Status: ${meta.status} | Seasons: ${meta.number_of_seasons} | Episodes: ${meta.number_of_episodes}`);

        // 2. Fetch OMDb + TVDB in parallel (independent of each other)
        const tvdbId = meta.external_ids.tvdb;
        console.log(`   ║ 🔄 Fetching OMDb + TVDB in parallel...`);

        const [omdbData, tvdbResult] = await Promise.all([
            // OMDb ratings
            meta.external_ids.imdb
                ? fetchOmdbData(meta.external_ids.imdb)
                : Promise.resolve(null),
            // TVDB enrichment
            (tvdbId && TVDB_API_KEY)
                ? getSeriesExtended(Number(tvdbId), TVDB_API_KEY, TVDB_PIN || undefined)
                    .catch((err: Error) => {
                        console.log(`   ║    ⚠️ TVDB fetch failed: ${err.message}`);
                        return null;
                    })
                : Promise.resolve(null),
        ]);

        if (omdbData) {
            console.log(`   ║    IMDB: ${omdbData.imdb_rating || 'N/A'} | RT: ${omdbData.rotten_tomatoes_rating || 'N/A'}%`);
        }

        // 3. Process TVDB enrichment results
        let tvdbEnrichment: TvdbEnrichmentResult | null = null;
        if (tvdbResult) {
            tvdbEnrichment = extractEnrichment(tvdbResult);

            // Detailed TVDB logging
            console.log(`   ║ ╔══ TVDB ENRICHMENT ══════════════════════════════════════`);
            console.log(`   ║ ║ 🎭 Characters: ${tvdbEnrichment.characters.length}`);
            if (tvdbEnrichment.characters.length > 0) {
                const topChars = tvdbEnrichment.characters.slice(0, 5);
                topChars.forEach((c, i) => {
                    console.log(`   ║ ║    ${i + 1}. ${c.name} (${c.actorName}) [${c.tier}]`);
                });
                if (tvdbEnrichment.characters.length > 5) {
                    console.log(`   ║ ║    ...and ${tvdbEnrichment.characters.length - 5} more`);
                }
            }

            console.log(`   ║ ║ 🏷️  Semantic Tags: ${tvdbEnrichment.semanticTags.length}`);
            if (tvdbEnrichment.semanticTags.length > 0) {
                console.log(`   ║ ║    ${tvdbEnrichment.semanticTags.slice(0, 10).join(', ')}${tvdbEnrichment.semanticTags.length > 10 ? '...' : ''}`);
            }

            console.log(`   ║ ║ 📋 Official Lists: ${tvdbEnrichment.officialLists.length}`);
            if (tvdbEnrichment.officialLists.length > 0) {
                tvdbEnrichment.officialLists.forEach(list => {
                    console.log(`   ║ ║    • ${list}`);
                });
            }

            if (tvdbEnrichment.contentRating) {
                console.log(`   ║ ║ 🔞 Content Rating: ${tvdbEnrichment.contentRating}`);
            }

            // Check for universe detection
            const universeSlug = detectUniverseFromOfficialLists(tvdbEnrichment.officialLists);
            if (universeSlug) {
                console.log(`   ║ ║ 🌌 Universe Detected: ${universeSlug}`);
            }

            // Check if anime
            if (tvdbResult && isAnime(tvdbResult)) {
                console.log(`   ║ ║ 🎌 Anime Detected`);
                if (tvdbEnrichment.absoluteEpisodeCount) {
                    console.log(`   ║ ║    Absolute Episodes: ${tvdbEnrichment.absoluteEpisodeCount}`);
                }
            }

            console.log(`   ║ ╚═══════════════════════════════════════════════════════`);
        } else if (!tvdbId) {
            console.log(`   ║ ⏭️  No TVDB ID available`);
        } else if (!TVDB_API_KEY) {
            console.log(`   ║ ⏭️  TVDB_API_KEY not configured`);
        }

        // 4. Semantic hash (skip AI regen when TMDB content unchanged)
        const newSemanticHash = computeSemanticHash(
            meta.title,
            meta.overview || '',
            meta.cast,
            meta.genres
        );
        const semanticChanged = hasSemanticChanges(item.semantic_hash || null, newSemanticHash);
        if (!semanticChanged && !FORCE_REGEN && !ONLY_MODE) {
            console.log(`   ║ ⚡ Semantic hash unchanged — skipping AI regen`);
        }

        // Check if we need to regenerate AI content
        // ONLY_MODE restricts to a single phase
        const hasStructuredDesc = item.description_parts &&
            item.description_parts.premise &&
            item.description_parts.themes &&
            item.description_parts.tone &&
            item.description_parts.style &&
            item.description_parts.semanticSummary;

        const needsDescription = ONLY_MODE
            ? ONLY_MODE === 'desc'
            : FORCE_DESC || (semanticChanged && (!item.description || item.description.length < 50 || !hasStructuredDesc));
        const needsTags = ONLY_MODE
            ? ONLY_MODE === 'tags'
            : FORCE_TAGS || !item.cached_tags || (item.cached_tags as any[]).length === 0;
        const needsEmbedding = ONLY_MODE
            ? ONLY_MODE === 'embeddings'
            : FORCE_EMBEDDINGS || !item.vector_text || needsDescription;

        let description = item.description;
        let descriptionParts: StructuredDescription | null = item.description_parts || null;
        let validTags = item.cached_tags || [];
        let embeddingVector = null;
        let vibeScores: VibeScores | null = item.vibe_scores || null;

        if (needsDescription) {
            console.log(`   ║ 🧠 Regenerating structured description (4-part)...`);
            const context = {
                title: meta.title,
                originalDescription: meta.overview || '',
                type: 'TV_SHOW',
                metadata: {
                    ...meta.metadata,
                    releaseYear: meta.release_year,
                    original_language: meta.original_language
                },
                status: meta.status,
                // TV-specific context for better prompt routing
                genres: meta.genres,
                keywords: meta.keywords,
                networks: meta.networks
            };

            descriptionParts = await aiLimiter(() =>
                generateTvShowDescription(supabase, context)
            );
            description = combineDescription(descriptionParts);
            console.log(`   ║    ✅ Generated 5-part description:`);
            console.log(`   ║       Premise: ${descriptionParts.premise?.slice(0, 50) || 'N/A'}...`);
            console.log(`   ║       Themes: ${descriptionParts.themes?.slice(0, 50) || 'N/A'}...`);
            console.log(`   ║       Tone: ${descriptionParts.tone?.slice(0, 50) || 'N/A'}...`);
            console.log(`   ║       Style: ${descriptionParts.style?.slice(0, 50) || 'N/A'}...`);
            console.log(`   ║       SemanticSummary: ${descriptionParts.semanticSummary?.slice(0, 50) || 'N/A'}...`);
        }

        if (needsTags) {
            console.log(`   ║ 🏷️  Regenerating tags...`);
            const tagInput = [...(meta.keywords || []), ...meta.genres].join(', ');
            const aiTagNames = await aiLimiter(() =>
                generateTags(supabase, meta.title, `${description} Keywords: ${tagInput}`, 'TV_SHOW')
            );
            validTags = await ensureTags(supabase, aiTagNames);
            console.log(`   ║    ✅ Generated ${aiTagNames.length} tags`);
        }

        if (needsEmbedding) {
            console.log(`   ║ 🧮 Regenerating embedding...`);
            // Use buildEmbeddingText for proper vector-optimized content
            const vectorText = buildEmbeddingText({
                title: meta.title,
                category_type: 'TV_SHOW',
                description_parts: descriptionParts || undefined,
                description: description || undefined,
                genres: meta.genres,
                keywords: meta.keywords,
                cast: meta.cast,
                director: meta.director,
                studio: meta.studio,
                cached_tags: validTags as { id: string; name: string }[],
                metadata: meta.metadata
            });
            embeddingVector = await generateEmbedding(vectorText);
            if (embeddingVector) {
                console.log(`   ║    ✅ Embedding generated (${embeddingVector.length} dims)`);
            }
        }

        // 5. Generate vibe scores (new or regenerate if forced)
        const needsVibeScores = ONLY_MODE
            ? ONLY_MODE === 'vibes'
            : FORCE_VIBE || !item.vibe_scores;
        if (needsVibeScores) {
            console.log(`   ║ 🎭 Generating vibe scores (20 dimensions)...`);
            const llmConfig = await getLLMConfig(supabase);
            if (llmConfig.apiKey) {
                const startVibe = Date.now();
                vibeScores = await aiLimiter(() =>
                    generateVibeScores(
                        { apiKey: llmConfig.apiKey!, provider: llmConfig.provider, model: llmConfig.model, endpoint: llmConfig.endpoint },
                        { title: meta.title, overview: description || meta.overview, genres: meta.genres, keywords: meta.keywords }
                    )
                );
                if (vibeScores) {
                    console.log(`   ║    ✅ Vibe scores generated in ${Date.now() - startVibe}ms`);
                    // Show top 5 vibes sorted by score
                    const sortedVibes = Object.entries(vibeScores)
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .slice(0, 5)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(', ');
                    console.log(`   ║    Top 5: ${sortedVibes}`);
                } else {
                    console.log(`   ║    ⚠️  No vibe scores generated`);
                }
            } else {
                console.log(`   ║    ⚠️  No LLM config, skipping vibe scores`);
            }
        }

        // 6. PEER REVIEW: Semantic Neighborhood Check (against 233k library)
        // Validates new item by comparing against closest neighbors before saving
        let peerReviewResult: { neighbors: any[]; outlierTags: string[] } = { neighbors: [], outlierTags: [] };

        if (embeddingVector && embeddingVector.length > 0) {
            console.log(`   ║ 🔗 PEER REVIEW: Checking semantic neighborhood...`);

            // Find 5 closest neighbors using HNSW index
            const { data: neighbors, error: neighborError } = await supabase.rpc('find_semantic_neighbors', {
                p_embedding: embeddingVector,
                p_category_type: 'TV_SHOW',
                p_limit: 5
            });

            if (neighborError) {
                console.log(`   ║    ⚠️  Neighbor search failed: ${neighborError.message}`);
            } else if (neighbors && neighbors.length > 0) {
                peerReviewResult.neighbors = neighbors;

                console.log(`   ║ ╔══ SEMANTIC NEIGHBORS ══════════════════════════════════════`);
                neighbors.forEach((n: any, i: number) => {
                    const dist = n.distance?.toFixed(3) || 'N/A';
                    console.log(`   ║ ║ ${i + 1}. ${n.title} (dist: ${dist}) [${n.bucket_type || 'N/A'}]`);
                });
                console.log(`   ║ ╚═══════════════════════════════════════════════════════════`);

                // Validate bucket consistency
                const neighborBuckets = neighbors.map((n: any) => n.bucket_type).filter(Boolean);
                const bucketFromMeta = meta.metadata?.type === 'Scripted' ? 'NARRATIVE' :
                    meta.genres?.some((g: string) => g.toLowerCase().includes('documentary')) ? 'OBSERVATIONAL' :
                        'NARRATIVE';

                const uniqueBuckets = [...new Set(neighborBuckets)];
                if (uniqueBuckets.length === 1 && uniqueBuckets[0] !== bucketFromMeta) {
                    console.log(`   ║ ⚠️  BUCKET MISMATCH: Neighbors are ${uniqueBuckets[0]}, but detected ${bucketFromMeta}`);
                }
            }
        }

        // Outlier Detection: Check vibe scores against category averages
        if (vibeScores && Object.keys(vibeScores).length > 0) {
            console.log(`   ║ 📊 DRIFT CHECK: Comparing vibes to category averages...`);

            const { data: outliers, error: outlierError } = await supabase.rpc('detect_vibe_outliers', {
                p_vibe_scores: vibeScores,
                p_category_type: 'TV_SHOW'
            });

            if (outlierError) {
                console.log(`   ║    ⚠️  Outlier detection failed: ${outlierError.message}`);
            } else if (outliers && outliers.length > 0) {
                const extremeOutliers = outliers.filter((o: any) => o.is_outlier);

                if (extremeOutliers.length > 0) {
                    console.log(`   ║ 🚨 OUTLIERS DETECTED (${extremeOutliers.length} dimensions):`);
                    extremeOutliers.forEach((o: any) => {
                        const direction = o.item_score > o.category_avg ? 'HIGH' : 'LOW';
                        console.log(`   ║    • ${o.dimension}: ${o.item_score?.toFixed(2)} (avg: ${o.category_avg?.toFixed(2)}, z=${o.z_score?.toFixed(2)}) [${direction}]`);

                        // Add relational tags for extreme outliers
                        if (o.z_score > 4) {
                            peerReviewResult.outlierTags.push(`extreme-${o.dimension}`);
                        } else {
                            peerReviewResult.outlierTags.push(`${direction.toLowerCase()}-${o.dimension}`);
                        }
                    });

                    if (extremeOutliers.length >= 3) {
                        peerReviewResult.outlierTags.push('genre-defying');
                        console.log(`   ║ 🏷️  Added relational tags: ${peerReviewResult.outlierTags.join(', ')}`);
                    }
                } else {
                    console.log(`   ║    ✅ All vibe scores within normal range`);
                }
            }
        }

        // 7. Build update payload
        // NOTE: We don't update 'title' by default to avoid unique constraint violations
        // when TMDB renames a show. Use --update-title flag to force title updates.
        const UPDATE_TITLE = args.includes('--update-title');


        // DESC_ONLY mode skips metadata updates, only saves AI content
        const updatePayload: Record<string, any> = DESC_ONLY ? {
            last_metadata_update: new Date().toISOString(),
        } : {
            release_year: meta.release_year,
            runtime: meta.runtime,
            trailer_url: meta.trailer_url,
            tagline: meta.tagline,
            content_rating: omdbData?.rated || meta.content_rating,
            writer: omdbData?.writer || meta.writer,
            vote_average: meta.vote_average,
            vote_count: meta.vote_count,
            imdb_rating: omdbData?.imdb_rating || null,
            imdb_votes: omdbData?.imdb_votes || null,
            rotten_tomatoes_rating: omdbData?.rotten_tomatoes_rating || null,
            metacritic_rating: omdbData?.metacritic_rating || null,
            awards_text: omdbData?.awards || null,
            original_title: meta.original_title,
            status: meta.status,
            homepage: meta.homepage,
            original_language: meta.original_language,
            origin_countries: meta.origin_countries,
            cast: meta.cast,
            director: meta.director,
            studio: meta.studio,
            production_companies: meta.production_companies,
            networks: meta.networks,
            number_of_seasons: meta.number_of_seasons,
            number_of_episodes: meta.number_of_episodes,
            genres: meta.genres,
            keywords: meta.keywords,
            external_ids: meta.external_ids,
            watch_providers: meta.watch_providers,
            backdrop_path: meta.backdrop_path,
            logo_path: meta.logo_path,
            metadata: meta.metadata,
            last_metadata_update: new Date().toISOString(),
        };

        // Only include title if explicitly requested
        if (UPDATE_TITLE) {
            updatePayload.title = meta.title;
        }

        if (needsDescription && descriptionParts) {
            updatePayload.description = description;
            updatePayload.description_parts = descriptionParts;
        }
        if (needsTags) {
            updatePayload.cached_tags = validTags;
        }
        if (embeddingVector) {
            updatePayload.vector_text = JSON.stringify(embeddingVector);
        }
        // Always save the latest semantic hash
        updatePayload.semantic_hash = newSemanticHash;
        if (vibeScores && needsVibeScores) {
            updatePayload.vibe_scores = vibeScores;
        }

        // 5. Save with retry logic for unique constraint violations
        if (DRY_RUN) {
            console.log(`   ║ 🔍 DRY RUN - Would update ${Object.keys(updatePayload).length} fields`);
        } else {
            console.log(`   ║ 💾 Saving ${Object.keys(updatePayload).length} fields...`);
            const { error } = await (supabase.from('global_items') as any).update(updatePayload).eq('id', item.id);

            if (error) {
                // Check for unique constraint violation
                if (error.message.includes('idx_global_items_title_category_unique')) {
                    console.log(`   ║ ⚠️  Title conflict detected - TMDB title "${meta.title}" conflicts with existing item`);
                    console.log(`   ║    Keeping original title: "${item.title}"`);
                    // Title is already excluded by default, so this shouldn't happen unless --update-title is used
                    if (UPDATE_TITLE) {
                        // Retry without title
                        const { title: _removed, ...payloadWithoutTitle } = updatePayload;
                        const { error: retryError } = await (supabase.from('global_items') as any).update(payloadWithoutTitle).eq('id', item.id);
                        if (retryError) {
                            console.log(`   ║ ❌ Retry failed: ${retryError.message}`);
                            errorCount++;
                        } else {
                            console.log(`   ║ ✅ Updated successfully (title preserved)`);
                            successCount++;
                        }
                    } else {
                        errorCount++;
                    }
                } else {
                    console.log(`   ║ ❌ Error: ${error.message}`);
                    errorCount++;
                }
            } else {
                console.log(`   ║ ✅ Updated successfully`);
                successCount++;
                writeCheckpoint(item.id, item.title, processedCount);
            }
        }
        const itemElapsed = ((Date.now() - itemStartTime) / 1000).toFixed(1);
        console.log(`   ║ ⏱️  Completed in ${itemElapsed}s`);
        console.log(`   ╚════════════════════════════════════════════════════════════════`);

    } catch (error) {
        console.log(`   ║ ❌ Error: ${error}`);
        console.log(`   ╚════════════════════════════════════════════════════════════════`);
        errorCount++;
    }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const startTime = Date.now();

    console.log('═'.repeat(70));
    console.log('📺 TV SHOW REHARVEST');
    console.log('═'.repeat(70));
    console.log(`📅 Started: ${new Date().toISOString()}`);
    if (ITEM_LIMIT) console.log(`🔢 Limit: ${ITEM_LIMIT} items`);
    if (DRY_RUN) console.log(`🔍 Mode: DRY RUN (no changes saved)`);
    if (FORCE_REGEN) console.log(`♻️  Mode: FORCE (regenerate all AI content)`);
    if (DESC_ONLY) console.log(`📝 Mode: DESC ONLY (skip metadata updates)`);
    if (ONLY_MODE) console.log(`🎯 Mode: ONLY ${ONLY_MODE.toUpperCase()} (progressive enrichment)`);
    if (EXCLUDE_RECENT_HOURS) console.log(`⏳ Filter: Excluding items updated in the last ${EXCLUDE_RECENT_HOURS} hours`);
    if (START_AT > 0) console.log(`⏩ Start At: Skipping first ${START_AT} items`);
    if (RESUME) console.log(`🔄 Resume: Continuing from last checkpoint`);
    console.log('');

    // 1. Fetch all existing TV shows
    console.log('📥 Loading existing TV shows...');
    const items: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        let query = supabase
            .from('global_items')
            .select('id, title, external_ids, description, description_parts, cached_tags, vector_text, vibe_scores, semantic_hash, category_type, last_metadata_update')
            .eq('category_type', 'TV_SHOW')
            .order('last_metadata_update', { ascending: true, nullsFirst: true });

        if (EXCLUDE_RECENT_HOURS) {
            const cutoff = new Date(Date.now() - EXCLUDE_RECENT_HOURS * 60 * 60 * 1000).toISOString();
            query = query.or(`last_metadata_update.lt.${cutoff},last_metadata_update.is.null`);
        }

        query = query.range(offset, offset + PAGE_SIZE - 1);

        const { data, error } = await query;

        if (error) {
            console.error('❌ Failed to load items:', error);
            process.exit(1);
        }

        if (data && data.length > 0) {
            items.push(...data);
            offset += PAGE_SIZE;
            hasMore = data.length === PAGE_SIZE;
            if (ITEM_LIMIT && items.length >= ITEM_LIMIT) {
                hasMore = false;
            }
            process.stdout.write(`\r   📦 Loaded ${items.length} items...`);
        } else {
            hasMore = false;
        }
    }
    console.log('');

    // Apply limit, start-at, and resume
    let itemsToProcess = ITEM_LIMIT ? items.slice(0, ITEM_LIMIT) : items;
    if (RESUME) {
        const checkpoint = readCheckpoint();
        if (checkpoint) {
            const idx = itemsToProcess.findIndex(i => i.id === checkpoint.lastItemId);
            if (idx >= 0) {
                console.log(`🔄 Resuming after "${checkpoint.lastItemTitle}" (item ${idx + 1}/${itemsToProcess.length})`);
                itemsToProcess = itemsToProcess.slice(idx + 1);
            } else {
                console.log(`⚠️  Checkpoint item not found in current result set, starting from beginning`);
            }
        } else {
            console.log(`⚠️  No checkpoint file found, starting from beginning`);
        }
    } else if (START_AT > 0) {
        console.log(`⏩ Skipping first ${START_AT} items...`);
        itemsToProcess = itemsToProcess.slice(START_AT);
    }
    console.log(`\n📊 Found ${items.length} TV shows, processing ${itemsToProcess.length}${START_AT > 0 ? ` (starting at #${START_AT + 1})` : ''}${RESUME ? ' (resumed)' : ''}`);
    console.log('─'.repeat(70));

    // 2. Process each item with concurrency
    const tasks = itemsToProcess.map(item => limit(async () => {
        await processItem(item);
    }));

    await Promise.all(tasks);

    // 3. Summary
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('');
    console.log('═'.repeat(70));
    console.log('📊 REHARVEST COMPLETE');
    console.log('═'.repeat(70));
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors:  ${errorCount}`);
    console.log(`   ⏱️  Time:    ${elapsed} minutes`);
    // Clean up checkpoint on successful completion
    if (errorCount === 0 && fs.existsSync(CHECKPOINT_FILE)) {
        fs.unlinkSync(CHECKPOINT_FILE);
        console.log(`   🧹 Checkpoint file cleaned up`);
    }
    console.log('═'.repeat(70));
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
