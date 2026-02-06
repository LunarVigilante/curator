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
 *   npx tsx src/scripts/reharvest-tv.ts           # Run full reharvest
 *   npx tsx src/scripts/reharvest-tv.ts --limit=50    # Limit to 50 items
 *   npx tsx src/scripts/reharvest-tv.ts --dry-run     # Preview without saving
 *   npx tsx src/scripts/reharvest-tv.ts --force       # Force regen descriptions/tags/embeddings
 */

import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';

// ============================================================================
// CONFIG
// ============================================================================

const CONCURRENCY = 5;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const OMDB_BASE_URL = 'https://www.omdbapi.com';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

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

if (!TMDB_API_KEY) {
    console.error('❌ Missing TMDB_API_KEY');
    process.exit(1);
}

if (!OMDB_API_KEY) {
    console.warn('⚠️  Missing OMDB_API_KEY. Ratings will be skipped.');
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
    console.log(`\n   ╔════════════════════════════════════════════════════════════════`);
    console.log(`   ║ 📺 ${processedCount}. ${item.title}`);
    console.log(`   ╠════════════════════════════════════════════════════════════════`);
    console.log(`   ║ TMDB ID: ${tmdbId} | UUID: ${item.id.slice(0, 8)}...`);

    try {
        // 1. Fetch fresh TMDB data
        console.log(`   ║ 🔄 Fetching TMDB data...`);
        const details = await fetchTmdbDetails(Number(tmdbId));
        if (!details) {
            console.log(`   ║ ⚠️  Not found on TMDB`);
            skippedCount++;
            return;
        }

        const meta = extractMetadata(details);
        console.log(`   ║    Status: ${meta.status} | Seasons: ${meta.number_of_seasons} | Episodes: ${meta.number_of_episodes}`);

        // 2. Fetch OMDb ratings
        let omdbData = null;
        if (meta.external_ids.imdb) {
            console.log(`   ║ 🎯 Fetching OMDb data...`);
            omdbData = await fetchOmdbData(meta.external_ids.imdb);
            if (omdbData) {
                console.log(`   ║    IMDB: ${omdbData.imdb_rating || 'N/A'} | RT: ${omdbData.rotten_tomatoes_rating || 'N/A'}%`);
            }
        }

        // 3. Check if we need to regenerate AI content
        const needsDescription = FORCE_DESC || !item.description || item.description.length < 50;
        const needsTags = FORCE_TAGS || !item.cached_tags || (item.cached_tags as any[]).length === 0;
        const needsEmbedding = FORCE_EMBEDDINGS || !item.vector_text;

        let description = item.description;
        let validTags = item.cached_tags || [];
        let embeddingVector = null;

        if (needsDescription) {
            console.log(`   ║ 🧠 Regenerating description...`);
            const richContext = `
Title: ${meta.title} (${meta.release_year})
Creator: ${meta.metadata?.created_by?.join(', ') || 'N/A'}
Cast: ${meta.cast.slice(0, 5).join(', ')}
Genres: ${meta.genres.join(', ')}
Keywords: ${meta.keywords.join(', ')}
Status: ${meta.status}
Overview: ${meta.overview || 'N/A'}
            `.trim();

            description = await aiLimiter(() =>
                rewriteDescription(supabase, meta.title, richContext, 'TV_SHOW')
            );
            console.log(`   ║    ✅ Generated: ${description.slice(0, 60)}...`);
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
            const vectorText = `
                Title: ${meta.title}
                Creator: ${meta.metadata?.created_by?.join(', ') || 'Unknown'}
                Keywords: ${meta.keywords.slice(0, 10).join(', ')}
                Plot: ${description}
            `.trim();
            embeddingVector = await generateEmbedding(vectorText);
            if (embeddingVector) {
                console.log(`   ║    ✅ Embedding generated (${embeddingVector.length} dims)`);
            }
        }

        // 4. Build update payload
        const updatePayload: Record<string, any> = {
            title: meta.title,
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

        if (needsDescription) {
            updatePayload.description = description;
        }
        if (needsTags) {
            updatePayload.cached_tags = validTags;
        }
        if (embeddingVector) {
            updatePayload.vector_text = JSON.stringify(embeddingVector);
        }

        // 5. Save
        if (DRY_RUN) {
            console.log(`   ║ 🔍 DRY RUN - Would update ${Object.keys(updatePayload).length} fields`);
        } else {
            console.log(`   ║ 💾 Saving ${Object.keys(updatePayload).length} fields...`);
            const { error } = await (supabase.from('global_items') as any).update(updatePayload).eq('id', item.id);
            if (error) {
                console.log(`   ║ ❌ Error: ${error.message}`);
                errorCount++;
            } else {
                console.log(`   ║ ✅ Updated successfully`);
                successCount++;
            }
        }
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
    if (EXCLUDE_RECENT_HOURS) console.log(`⏳ Filter: Excluding items updated in the last ${EXCLUDE_RECENT_HOURS} hours`);
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
            .select('id, title, external_ids, description, cached_tags, vector_text, category_type')
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

    // Apply limit
    const itemsToProcess = ITEM_LIMIT ? items.slice(0, ITEM_LIMIT) : items;
    console.log(`\n📊 Found ${items.length} TV shows, processing ${itemsToProcess.length}`);
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
    console.log('═'.repeat(70));
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
