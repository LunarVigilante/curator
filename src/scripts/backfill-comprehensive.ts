/**
 * Comprehensive Metadata Backfill Script
 * 
 * This script processes items in 4 phases to fill in missing metadata:
 * 1. OMDB Metadata - Fetches ratings, awards, writer, box office (MOVIE, TV_SHOW, ANIME)
 * 2. 4-Part Descriptions - Generates structured descriptions (premise, themes, tone, style)
 * 3. Tag Generation - Generates AI tags for items with missing cached_tags
 * 4. Embedding Regeneration - Rebuilds embeddings using enriched metadata
 * 
 * Usage:
 *   npx tsx src/scripts/backfill-comprehensive.ts --category=MOVIE
 *   npx tsx src/scripts/backfill-comprehensive.ts --category=TV_SHOW --limit=100
 *   npx tsx src/scripts/backfill-comprehensive.ts --category=ANIME --phase=omdb
 *   npx tsx src/scripts/backfill-comprehensive.ts --category=MOVIE --dry-run
 * 
 * Options:
 *   --category=<TYPE>  Required. Category to process (MOVIE, TV_SHOW, ANIME, VIDEO_GAME, etc.)
 *   --limit=<N>        Optional. Process only N items per phase
 *   --phase=<PHASE>    Optional. Run specific phase: omdb, descriptions, tags, embeddings, all (default: all)
 *   --dry-run          Optional. Preview changes without saving
 *   --force            Optional. Force regeneration even if data exists
 */

import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description';
import { generateEmbedding, generateTags, ensureTags, aiLimiter, sleep } from '@/lib/harvesters/shared';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BATCH_SIZE = 50;
const DELAY_BETWEEN_ITEMS = 100; // ms
const OMDB_BASE_URL = 'https://www.omdbapi.com';
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const VALID_CATEGORIES = [
    'ANIME', 'MOVIE', 'TV_SHOW', 'VIDEO_GAME', 'BOARD_GAME', 'BOOK',
    'MANGA', 'LIGHT_NOVEL', 'MUSIC_ARTIST', 'MUSIC_ALBUM', 'MUSIC_TRACK', 'PODCAST', 'COMICS'
];

const OMDB_SUPPORTED_CATEGORIES = ['MOVIE', 'TV_SHOW', 'ANIME'];
const TMDB_SUPPORTED_CATEGORIES = ['MOVIE', 'TV_SHOW'];

type Phase = 'omdb' | 'tmdb' | 'descriptions' | 'tags' | 'embeddings' | 'all';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface CLIOptions {
    category: string;
    limit?: number;
    phase: Phase;
    dryRun: boolean;
    force: boolean;
}

function parseArgs(): CLIOptions {
    const args = process.argv.slice(2);

    const categoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1]?.toUpperCase();
    const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
    const phaseArg = args.find(a => a.startsWith('--phase='))?.split('=')[1]?.toLowerCase() as Phase;
    const dryRun = args.includes('--dry-run');
    const force = args.includes('--force');

    if (!categoryArg) {
        console.error('\n❌ ERROR: --category flag is required');
        console.error('   Usage: npx tsx src/scripts/backfill-comprehensive.ts --category=MOVIE\n');
        console.error('   Valid categories:', VALID_CATEGORIES.join(', '));
        process.exit(1);
    }

    if (!VALID_CATEGORIES.includes(categoryArg)) {
        console.error(`\n❌ ERROR: Invalid category "${categoryArg}"`);
        console.error('   Valid categories:', VALID_CATEGORIES.join(', '));
        process.exit(1);
    }

    const validPhases: Phase[] = ['omdb', 'tmdb', 'descriptions', 'tags', 'embeddings', 'all'];
    const phase = phaseArg && validPhases.includes(phaseArg) ? phaseArg : 'all';

    return {
        category: categoryArg,
        limit: limitArg ? parseInt(limitArg, 10) : undefined,
        phase,
        dryRun,
        force
    };
}

// ============================================================================
// OMDB FUNCTIONS (Adapted from harvest-tmdb-smart.ts)
// ============================================================================

interface OMDbData {
    imdb_rating: number | null;
    imdb_votes: number | null;
    rotten_tomatoes_rating: number | null;
    metacritic_rating: number | null;
    awards: string | null;
    rated: string | null;
    writer: string | null;
    box_office: string | null;
}

async function fetchOmdbData(imdbId: string): Promise<OMDbData | null> {
    if (!OMDB_API_KEY || !imdbId) return null;

    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&i=${imdbId}&tomatoes=true`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`   ⚠️ OMDb HTTP Error ${res.status} for ${imdbId}`);
            return null;
        }

        const data = await res.json();
        if (data.Response === 'False') {
            console.warn(`   ⚠️ OMDb API Error for ${imdbId}: ${data.Error}`);
            return null;
        }

        // Extract Rotten Tomatoes safely
        let rtScore: number | null = null;
        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
        if (rtSource && rtSource.Value) {
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
            box_office: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
        };
    } catch (e: any) {
        console.warn(`   ⚠️ OMDb Exception for ${imdbId}:`, e.message);
        return null;
    }
}

async function fetchOmdbDataByTitle(title: string, year: number): Promise<OMDbData | null> {
    if (!OMDB_API_KEY) return null;

    // Clean title for anime (remove parenthetical notes, etc.)
    const cleanTitle = title.replace(/\s*\([^)]*\)\s*/g, '').trim();

    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(cleanTitle)}&y=${year}&tomatoes=true`;
    try {
        let res = await fetch(url);
        let data = await res.json();

        // Attempt 2: Loose Year (OMDb sometimes has years off by 1)
        if (data.Response === 'False') {
            const looseUrl = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(cleanTitle)}&tomatoes=true`;
            res = await fetch(looseUrl);
            data = await res.json();
        }

        if (!res.ok || data.Response === 'False') return null;

        let rtScore: number | null = null;
        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
        if (rtSource && rtSource.Value) {
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
            box_office: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
        };
    } catch (e) {
        return null;
    }
}

// ============================================================================
// TMDB FUNCTIONS (For TV Metadata: created_by, episode_run_time, etc.)
// ============================================================================

async function fetchTmdbDetails(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<any | null> {
    if (!TMDB_API_KEY || !tmdbId) return null;

    const url = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 429) {
                console.warn('   ⚠️ TMDB Rate limited. Sleeping 2s...');
                await sleep(2000);
                return fetchTmdbDetails(tmdbId, mediaType);
            }
            if (res.status === 404) return null;
            return null;
        }
        return await res.json();
    } catch (e: any) {
        console.warn(`   ⚠️ TMDB Exception for ${tmdbId}:`, e.message);
        return null;
    }
}

// ============================================================================
// PHASE 1.5: TMDB METADATA BACKFILL (TV: created_by, episode_run_time, dates)
// ============================================================================

async function runTmdbPhase(supabase: any, options: CLIOptions): Promise<{ processed: number, updated: number, skipped: number, failed: number }> {
    const stats = { processed: 0, updated: 0, skipped: 0, failed: 0 };

    if (!TMDB_SUPPORTED_CATEGORIES.includes(options.category)) {
        console.log(`\n⏭️  TMDB Phase: Skipping (not supported for ${options.category})`);
        return stats;
    }

    if (!TMDB_API_KEY) {
        console.warn('\n⚠️  TMDB Phase: Skipping (TMDB_API_KEY not set)');
        return stats;
    }

    console.log('\n' + '═'.repeat(70));
    console.log('📺 PHASE 1.5: TMDB METADATA BACKFILL (TV Shows)');
    console.log('═'.repeat(70));

    const isTV = options.category === 'TV_SHOW';
    const mediaType = isTV ? 'tv' : 'movie';

    // Query items with TMDB ID but missing TV metadata
    let query = supabase
        .from('global_items')
        .select('id, title, external_ids, metadata')
        .eq('category_type', options.category)
        .not('external_ids', 'is', null);

    // For TV, look for items missing created_by in metadata
    if (isTV && !options.force) {
        query = query.or('metadata.is.null,metadata->>created_by.is.null');
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data: items, error } = await query;

    if (error) {
        console.error('❌ Query error:', error);
        return stats;
    }

    console.log(`📋 Found ${items?.length || 0} items needing TMDB metadata\n`);

    if (!items || items.length === 0) {
        console.log('✅ All items already have TMDB metadata!');
        return stats;
    }

    for (const item of items) {
        stats.processed++;

        const tmdbId = item.external_ids?.tmdb || item.external_ids?.tmdb_tv;
        if (!tmdbId) {
            console.log(`   ⚠️ [${stats.processed}/${items.length}] ${item.title} - No TMDB ID`);
            stats.skipped++;
            continue;
        }

        console.log(`   ╔════════════════════════════════════════════════════════════════`);
        console.log(`   ║ 📺 [${stats.processed}/${items.length}] ${item.title}`);
        console.log(`   ╠════════════════════════════════════════════════════════════════`);
        console.log(`   ║ ID: ${item.id}`);
        console.log(`   ║ TMDB ID: ${tmdbId}`);

        // Fetch TMDB details
        console.log(`   ║ 🎯 Fetching TMDB details...`);
        const details = await fetchTmdbDetails(tmdbId, mediaType);

        if (!details) {
            console.log(`   ║ ⚠️ No TMDB data found`);
            console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
            stats.skipped++;
            await sleep(DELAY_BETWEEN_ITEMS);
            continue;
        }

        // Extract TV-specific metadata
        const createdBy = details.created_by?.map((c: any) => c.name) || [];
        const episodeRunTime = details.episode_run_time || [];
        const type = details.type || null;
        const firstAirDate = details.first_air_date || null;
        const lastAirDate = details.last_air_date || null;

        console.log(`   ║ ✅ TMDB data retrieved`);
        if (isTV) {
            console.log(`   ║    Created By: ${createdBy.slice(0, 3).join(', ') || 'N/A'}`);
            console.log(`   ║    Episode Runtime: ${episodeRunTime[0] || 'N/A'}m`);
            console.log(`   ║    Type: ${type || 'N/A'}`);
            console.log(`   ║    Air Dates: ${firstAirDate || 'N/A'} - ${lastAirDate || 'N/A'}`);
        }

        if (options.dryRun) {
            console.log(`   ║ 🔍 DRY RUN: Would update metadata`);
            console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
            stats.updated++;
            continue;
        }

        // Build update payload - merge with existing metadata
        const existingMetadata = item.metadata || {};
        const newMetadata = {
            ...existingMetadata,
            created_by: createdBy.length > 0 ? createdBy : existingMetadata.created_by,
            episode_run_time: episodeRunTime.length > 0 ? episodeRunTime : existingMetadata.episode_run_time,
            type: type || existingMetadata.type,
            first_air_date: firstAirDate || existingMetadata.first_air_date,
            last_air_date: lastAirDate || existingMetadata.last_air_date,
        };

        console.log(`   ║ 💾 Saving to database...`);
        const { error: updateError } = await supabase
            .from('global_items')
            .update({
                metadata: newMetadata,
                last_metadata_update: new Date().toISOString()
            })
            .eq('id', item.id);

        if (updateError) {
            console.log(`   ║ ❌ Update failed: ${updateError.message}`);
            stats.failed++;
        } else {
            console.log(`   ║ ✅ Saved successfully`);
            stats.updated++;
        }

        console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
        await sleep(DELAY_BETWEEN_ITEMS);
    }

    console.log(`\n📊 TMDB Phase Complete: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
}

// ============================================================================
// PHASE 1: OMDB METADATA BACKFILL
// ============================================================================

async function runOmdbPhase(supabase: any, options: CLIOptions): Promise<{ processed: number, updated: number, skipped: number, failed: number }> {
    const stats = { processed: 0, updated: 0, skipped: 0, failed: 0 };

    if (!OMDB_SUPPORTED_CATEGORIES.includes(options.category)) {
        console.log(`\n⏭️  OMDB Phase: Skipping (not supported for ${options.category})`);
        return stats;
    }

    if (!OMDB_API_KEY) {
        console.warn('\n⚠️  OMDB Phase: Skipping (OMDB_API_KEY not set)');
        return stats;
    }

    console.log('\n' + '═'.repeat(70));
    console.log('📊 PHASE 1: OMDB METADATA BACKFILL');
    console.log('═'.repeat(70));

    // Query items missing OMDB data
    let query = supabase
        .from('global_items')
        .select('id, title, release_year, external_ids, imdb_rating, rotten_tomatoes_rating, metacritic_rating, romaji_title')
        .eq('category_type', options.category);

    if (!options.force) {
        // Only items missing at least one OMDB field
        query = query.or('imdb_rating.is.null,rotten_tomatoes_rating.is.null,metacritic_rating.is.null');
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data: items, error } = await query;

    if (error) {
        console.error('❌ Query error:', error);
        return stats;
    }

    console.log(`📋 Found ${items?.length || 0} items needing OMDB data\n`);

    if (!items || items.length === 0) {
        console.log('✅ All items already have OMDB data!');
        return stats;
    }

    for (const item of items) {
        stats.processed++;

        console.log(`   ╔════════════════════════════════════════════════════════════════`);
        console.log(`   ║ 🎬 [${stats.processed}/${items.length}] ${item.title}`);
        console.log(`   ╠════════════════════════════════════════════════════════════════`);
        console.log(`   ║ ID: ${item.id}`);
        console.log(`   ║ Year: ${item.release_year || 'N/A'}`);
        console.log(`   ║ Current: IMDB ${item.imdb_rating || 'N/A'} | RT ${item.rotten_tomatoes_rating || 'N/A'}% | MC ${item.metacritic_rating || 'N/A'}`);

        // Try fetching OMDB data
        let omdbData: OMDbData | null = null;
        const imdbId = item.external_ids?.imdb;

        if (imdbId) {
            console.log(`   ║ 🎯 Fetching by IMDB ID: ${imdbId}...`);
            omdbData = await fetchOmdbData(imdbId);
        }

        if (!omdbData && item.title && item.release_year) {
            console.log(`   ║ 🎯 Fetching by Title+Year: "${item.title}" (${item.release_year})...`);
            omdbData = await fetchOmdbDataByTitle(item.title, item.release_year);
        }

        // For anime, try romaji title as fallback
        if (!omdbData && item.romaji_title && item.release_year) {
            console.log(`   ║ 🎯 Fetching by Romaji Title: "${item.romaji_title}"...`);
            omdbData = await fetchOmdbDataByTitle(item.romaji_title, item.release_year);
        }

        if (!omdbData) {
            console.log(`   ║ ⚠️  No OMDB data found`);
            console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
            stats.skipped++;
            await sleep(DELAY_BETWEEN_ITEMS);
            continue;
        }

        console.log(`   ║ ✅ OMDB data retrieved`);
        console.log(`   ║    IMDB: ${omdbData.imdb_rating || 'N/A'} | RT: ${omdbData.rotten_tomatoes_rating || 'N/A'}% | MC: ${omdbData.metacritic_rating || 'N/A'}`);
        console.log(`   ║    Awards: ${omdbData.awards || 'N/A'}`);

        if (options.dryRun) {
            console.log(`   ║ 🔍 DRY RUN: Would update with OMDB data`);
            console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
            stats.updated++;
            continue;
        }

        // Build update payload (only update missing fields unless force)
        const updatePayload: any = {
            last_metadata_update: new Date().toISOString()
        };

        if (omdbData.imdb_rating && (options.force || !item.imdb_rating)) {
            updatePayload.imdb_rating = omdbData.imdb_rating;
        }
        if (omdbData.imdb_votes) {
            updatePayload.imdb_votes = omdbData.imdb_votes;
        }
        if (omdbData.rotten_tomatoes_rating && (options.force || !item.rotten_tomatoes_rating)) {
            updatePayload.rotten_tomatoes_rating = omdbData.rotten_tomatoes_rating;
        }
        if (omdbData.metacritic_rating && (options.force || !item.metacritic_rating)) {
            updatePayload.metacritic_rating = omdbData.metacritic_rating;
        }
        if (omdbData.awards) {
            updatePayload.awards_text = omdbData.awards;
        }
        if (omdbData.rated) {
            updatePayload.content_rating = omdbData.rated;
        }
        if (omdbData.writer) {
            updatePayload.writer = omdbData.writer;
        }
        if (omdbData.box_office) {
            updatePayload.box_office = omdbData.box_office;
        }

        console.log(`   ║ 💾 Saving to database...`);
        const { error: updateError } = await supabase
            .from('global_items')
            .update(updatePayload)
            .eq('id', item.id);

        if (updateError) {
            console.log(`   ║ ❌ Update failed: ${updateError.message}`);
            stats.failed++;
        } else {
            console.log(`   ║ ✅ Saved successfully`);
            stats.updated++;
        }

        console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
        await sleep(DELAY_BETWEEN_ITEMS);
    }

    console.log(`\n📊 OMDB Phase Complete: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
}

// ============================================================================
// PHASE 2: 4-PART STRUCTURED DESCRIPTIONS
// ============================================================================

async function runDescriptionsPhase(supabase: any, options: CLIOptions): Promise<{ processed: number, updated: number, skipped: number, failed: number }> {
    const stats = { processed: 0, updated: 0, skipped: 0, failed: 0 };

    console.log('\n' + '═'.repeat(70));
    console.log('📝 PHASE 2: 4-PART STRUCTURED DESCRIPTIONS');
    console.log('═'.repeat(70));

    // Query items missing description_parts but having description
    let query = supabase
        .from('global_items')
        .select('id, title, description, category_type, genres, cast, director, studio, developers, publishers, designers, mechanics, platforms, cached_tags, metadata')
        .eq('category_type', options.category)
        .not('description', 'is', null);

    if (!options.force) {
        query = query.is('description_parts', null);
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data: items, error } = await query;

    if (error) {
        console.error('❌ Query error:', error);
        return stats;
    }

    console.log(`📋 Found ${items?.length || 0} items needing structured descriptions\n`);

    if (!items || items.length === 0) {
        console.log('✅ All items already have structured descriptions!');
        return stats;
    }

    for (const item of items) {
        stats.processed++;

        console.log(`   ╔════════════════════════════════════════════════════════════════`);
        console.log(`   ║ 📽️  [${stats.processed}/${items.length}] ${item.title}`);
        console.log(`   ╠════════════════════════════════════════════════════════════════`);
        console.log(`   ║ ID: ${item.id}`);
        console.log(`   ║ Category: ${item.category_type}`);
        console.log(`   ║ Original Description: ${(item.description || '').slice(0, 100)}...`);

        try {
            // Generate 4-part structured description
            console.log(`   ║ 🧠 Generating 4-part structured description...`);
            const startTime = Date.now();

            const description_parts = await aiLimiter(() =>
                generateStructuredDescription(supabase, {
                    title: item.title,
                    originalDescription: item.description,
                    type: item.category_type,
                    metadata: item.metadata
                })
            );
            const descTime = Date.now() - startTime;

            console.log(`   ║ ✅ Description generated in ${descTime}ms`);
            console.log(`   ║    📝 Premise: ${(description_parts.premise || '').slice(0, 60)}...`);
            console.log(`   ║    📝 Themes: ${(description_parts.themes || '').slice(0, 60)}...`);
            console.log(`   ║    📝 Tone: ${(description_parts.tone || '').slice(0, 60)}...`);
            console.log(`   ║    📝 Style: ${(description_parts.style || '').slice(0, 60)}...`);

            // Combine for backwards compatibility
            const description = combineDescription(description_parts);
            console.log(`   ║ 📄 Combined description length: ${description.length} chars`);

            if (options.dryRun) {
                console.log(`   ║ 🔍 DRY RUN: Would update description_parts`);
                console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
                stats.updated++;
                continue;
            }

            // Update item
            console.log(`   ║ 💾 Saving to database...`);
            const { error: updateError } = await supabase
                .from('global_items')
                .update({
                    description,
                    description_parts,
                    last_metadata_update: new Date().toISOString()
                })
                .eq('id', item.id);

            if (updateError) {
                console.log(`   ║ ❌ Update failed: ${updateError.message}`);
                stats.failed++;
            } else {
                console.log(`   ║ ✅ Saved successfully`);
                stats.updated++;
            }

        } catch (err: any) {
            console.log(`   ║ ❌ Generation failed: ${err.message}`);
            stats.failed++;
        }

        console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
        await sleep(DELAY_BETWEEN_ITEMS);
    }

    console.log(`\n📊 Descriptions Phase Complete: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
}

// ============================================================================
// PHASE 3: TAG GENERATION
// ============================================================================

async function runTagsPhase(supabase: any, options: CLIOptions): Promise<{ processed: number, updated: number, skipped: number, failed: number }> {
    const stats = { processed: 0, updated: 0, skipped: 0, failed: 0 };

    console.log('\n' + '═'.repeat(70));
    console.log('🏷️  PHASE 3: TAG GENERATION');
    console.log('═'.repeat(70));

    // Query items missing tags
    let query = supabase
        .from('global_items')
        .select('id, title, description, category_type, genres, keywords')
        .eq('category_type', options.category)
        .not('description', 'is', null);

    if (!options.force) {
        query = query.or('cached_tags.is.null,cached_tags.eq.[]');
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data: items, error } = await query;

    if (error) {
        console.error('❌ Query error:', error);
        return stats;
    }

    console.log(`📋 Found ${items?.length || 0} items needing tags\n`);

    if (!items || items.length === 0) {
        console.log('✅ All items already have tags!');
        return stats;
    }

    for (const item of items) {
        stats.processed++;

        console.log(`   ╔════════════════════════════════════════════════════════════════`);
        console.log(`   ║ 🏷️  [${stats.processed}/${items.length}] ${item.title}`);
        console.log(`   ╠════════════════════════════════════════════════════════════════`);
        console.log(`   ║ ID: ${item.id}`);
        console.log(`   ║ Genres: ${(item.genres || []).slice(0, 5).join(', ') || 'N/A'}`);

        try {
            console.log(`   ║ 🤖 Generating AI tags...`);
            const startTime = Date.now();

            // Build context from existing metadata
            const tagContext = [
                item.description,
                `Genres: ${(item.genres || []).join(', ')}`,
                `Keywords: ${(item.keywords || []).join(', ')}`
            ].filter(Boolean).join(' ');

            const tagNames = await aiLimiter(() =>
                generateTags(supabase, item.title, tagContext, item.category_type)
            );

            const validTags = await ensureTags(supabase, tagNames);
            const tagTime = Date.now() - startTime;

            console.log(`   ║ ✅ Generated ${tagNames.length} tags in ${tagTime}ms`);
            console.log(`   ║    Tags: ${tagNames.slice(0, 8).join(', ')}`);

            if (options.dryRun) {
                console.log(`   ║ 🔍 DRY RUN: Would update cached_tags`);
                console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
                stats.updated++;
                continue;
            }

            // Update item
            console.log(`   ║ 💾 Saving to database...`);
            const { error: updateError } = await supabase
                .from('global_items')
                .update({
                    cached_tags: validTags,
                    last_metadata_update: new Date().toISOString()
                })
                .eq('id', item.id);

            if (updateError) {
                console.log(`   ║ ❌ Update failed: ${updateError.message}`);
                stats.failed++;
            } else {
                console.log(`   ║ ✅ Saved successfully`);
                stats.updated++;
            }

        } catch (err: any) {
            console.log(`   ║ ❌ Generation failed: ${err.message}`);
            stats.failed++;
        }

        console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
        await sleep(DELAY_BETWEEN_ITEMS);
    }

    console.log(`\n📊 Tags Phase Complete: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
}

// ============================================================================
// PHASE 4: EMBEDDING REGENERATION
// ============================================================================

async function runEmbeddingsPhase(supabase: any, options: CLIOptions): Promise<{ processed: number, updated: number, skipped: number, failed: number }> {
    const stats = { processed: 0, updated: 0, skipped: 0, failed: 0 };

    console.log('\n' + '═'.repeat(70));
    console.log('🧮 PHASE 4: EMBEDDING REGENERATION');
    console.log('═'.repeat(70));

    // Query items needing embeddings
    let query = supabase
        .from('global_items')
        .select('id, title, description, description_parts, category_type, genres, cast, director, studio, developers, publishers, designers, mechanics, platforms, cached_tags, metadata, themes')
        .eq('category_type', options.category);

    if (!options.force) {
        query = query.is('embedding', null);
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data: items, error } = await query;

    if (error) {
        console.error('❌ Query error:', error);
        return stats;
    }

    console.log(`📋 Found ${items?.length || 0} items needing embeddings\n`);

    if (!items || items.length === 0) {
        console.log('✅ All items already have embeddings!');
        return stats;
    }

    for (const item of items) {
        stats.processed++;

        console.log(`   ╔════════════════════════════════════════════════════════════════`);
        console.log(`   ║ 🧮 [${stats.processed}/${items.length}] ${item.title}`);
        console.log(`   ╠════════════════════════════════════════════════════════════════`);
        console.log(`   ║ ID: ${item.id}`);

        try {
            // Build rich embedding text
            console.log(`   ║ 🔗 Building embedding text from metadata...`);
            const embeddingText = buildEmbeddingText(item);
            console.log(`   ║    Embedding text length: ${embeddingText.length} chars`);

            // Generate embedding
            console.log(`   ║ 🧮 Generating embedding vector...`);
            const startTime = Date.now();
            const embedding = await generateEmbedding(embeddingText);
            const embedTime = Date.now() - startTime;

            if (!embedding) {
                console.log(`   ║ ⚠️  No embedding generated`);
                stats.skipped++;
                console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
                continue;
            }

            console.log(`   ║ ✅ Embedding generated in ${embedTime}ms (${embedding.length} dimensions)`);

            if (options.dryRun) {
                console.log(`   ║ 🔍 DRY RUN: Would update embedding`);
                console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
                stats.updated++;
                continue;
            }

            // Update item
            console.log(`   ║ 💾 Saving to database...`);
            const { error: updateError } = await supabase
                .from('global_items')
                .update({
                    embedding,
                    last_metadata_update: new Date().toISOString()
                })
                .eq('id', item.id);

            if (updateError) {
                console.log(`   ║ ❌ Update failed: ${updateError.message}`);
                stats.failed++;
            } else {
                console.log(`   ║ ✅ Saved successfully`);
                stats.updated++;
            }

        } catch (err: any) {
            console.log(`   ║ ❌ Generation failed: ${err.message}`);
            stats.failed++;
        }

        console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
        await sleep(DELAY_BETWEEN_ITEMS);
    }

    console.log(`\n📊 Embeddings Phase Complete: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const options = parseArgs();
    const supabase = createServiceRoleClient();

    console.log('\n' + '═'.repeat(70));
    console.log('🚀 COMPREHENSIVE METADATA BACKFILL');
    console.log('═'.repeat(70));
    console.log(`📂 Category: ${options.category}`);
    console.log(`📦 Phase: ${options.phase}`);
    if (options.limit) console.log(`📊 Limit: ${options.limit} items per phase`);
    if (options.dryRun) console.log(`🔍 DRY RUN MODE: No changes will be saved`);
    if (options.force) console.log(`⚡ FORCE MODE: Regenerating even if data exists`);
    console.log('═'.repeat(70));

    const totals = {
        omdb: { processed: 0, updated: 0, skipped: 0, failed: 0 },
        tmdb: { processed: 0, updated: 0, skipped: 0, failed: 0 },
        descriptions: { processed: 0, updated: 0, skipped: 0, failed: 0 },
        tags: { processed: 0, updated: 0, skipped: 0, failed: 0 },
        embeddings: { processed: 0, updated: 0, skipped: 0, failed: 0 }
    };

    // Run phases
    if (options.phase === 'all' || options.phase === 'tmdb') {
        totals.tmdb = await runTmdbPhase(supabase, options);
    }

    if (options.phase === 'all' || options.phase === 'omdb') {
        totals.omdb = await runOmdbPhase(supabase, options);
    }

    if (options.phase === 'all' || options.phase === 'descriptions') {
        totals.descriptions = await runDescriptionsPhase(supabase, options);
    }

    if (options.phase === 'all' || options.phase === 'tags') {
        totals.tags = await runTagsPhase(supabase, options);
    }

    if (options.phase === 'all' || options.phase === 'embeddings') {
        totals.embeddings = await runEmbeddingsPhase(supabase, options);
    }

    // Final summary
    console.log('\n' + '═'.repeat(70));
    console.log('✅ BACKFILL COMPLETE');
    console.log('═'.repeat(70));
    console.log(`📊 OMDB:         ${totals.omdb.updated} updated, ${totals.omdb.skipped} skipped, ${totals.omdb.failed} failed`);
    console.log(`📺 TMDB:         ${totals.tmdb.updated} updated, ${totals.tmdb.skipped} skipped, ${totals.tmdb.failed} failed`);
    console.log(`📝 Descriptions: ${totals.descriptions.updated} updated, ${totals.descriptions.skipped} skipped, ${totals.descriptions.failed} failed`);
    console.log(`🏷️  Tags:         ${totals.tags.updated} updated, ${totals.tags.skipped} skipped, ${totals.tags.failed} failed`);
    console.log(`🧮 Embeddings:   ${totals.embeddings.updated} updated, ${totals.embeddings.skipped} skipped, ${totals.embeddings.failed} failed`);
    console.log('═'.repeat(70) + '\n');
}

main().catch(console.error);
