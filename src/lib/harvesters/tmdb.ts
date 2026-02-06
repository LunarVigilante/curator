/**
 * Unified TMDB Harvester (Movies & TV Shows)
 * 
 * Supports two operations:
 * - harvest: Full discovery of NEW items (TMDB discover → details → OMDb → AI → insert)
 * - backfill: Smart update of EXISTING items with missing fields
 * 
 * Usage via CLI (harvest-tmdb.ts):
 *   npx tsx src/scripts/harvest-tmdb.ts --type=movie --operation=harvest
 *   npx tsx src/scripts/harvest-tmdb.ts --type=tv --operation=backfill --limit=500
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import {
    HarvestResult,
    sleep,
    aiLimiter,
    rewriteDescription,
    generateTags,
    ensureTags,
    generateEmbedding,
    generateAnthologySyntheticCentroid,
    didStatusBecomeEnded,
    type AnthologyEpisode
} from './shared';
import {
    generateTvShowDescription,
    buildTvShowVectorText,
    detectTvBucket,
    detectTvFormat,
    detectGenreLens,
    isAnthology,
    inferShowrunner,
    generateTvShowTags,
    translateToArchetypes,
    classifyFranchiseType,       // NEW: Save the Cat franchise classification
    type TvBucket,
    type TvFormat,
    type GenreLens,
    type FranchiseType           // NEW: Franchise type
} from '@/lib/enrichment/categories/tv-show';
import { getLLMConfig } from './shared';
import { detectUniverseFromKeywords, KNOWN_SPINOFFS } from '@/lib/constants/franchise-keywords';
import { fetchWikidataRelationships, resolveWikidataUniverseSlug, type WikidataRelationships } from '@/lib/services/wikidata';
import { detectIABFacets, type IABFacetType } from '@/lib/constants/iab-taxonomy';
import { getSeriesExtended, getSeriesEpisodes, getAbsoluteEpisodeCount, type TvdbEnrichmentResult, type TvdbEpisode } from '@/lib/services/tvdb';
import { extractEnrichment, isAnime, detectUniverseFromOfficialLists } from '@/lib/services/tvdb-utils';
import { SystemConfigService } from '@/lib/services/SystemConfigService';
import pLimit from 'p-limit';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const OMDB_BASE_URL = 'https://www.omdbapi.com';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const CONCURRENCY = 5;

// ============================================================================
// TYPES
// ============================================================================

export interface TmdbHarvestOptions {
    type: 'movie' | 'tv';
    operation: 'harvest' | 'backfill';
    startYear?: number;      // For harvest: start year (default: current year)
    endYear?: number;        // For harvest: end year (default: 1970)
    maxPages?: number;       // For harvest: max pages per year (default: 100)
    limit?: number;          // For backfill: max items to process
    dryRun?: boolean;        // Preview without writing
}

interface TriageItem {
    id: string;
    isComplete: boolean;
}

interface TmdbMetadata {
    title: string;
    original_title: string;
    overview: string;
    tagline: string | null;
    release_date: string;
    release_year: number;
    status: string;
    homepage: string;
    poster_path: string | null;
    backdrop_path: string | null;
    logo_path: string | null;
    trailer_url: string | null;
    popularity: number;
    vote_average: number;
    vote_count: number;
    budget: number;
    revenue: number;
    runtime: number;
    content_rating: string | null;
    writer: string | null;
    genres: string[];
    keywords: string[];
    original_language: string;
    origin_countries: string[];
    spoken_languages: string[];
    cast: string[];
    director: string | null;
    studio: string | null;
    production_companies: string[];
    networks: string[];
    number_of_seasons: number | null;
    number_of_episodes: number | null;
    external_ids: Record<string, any>;
    watch_providers: any;
    metadata: {
        created_by: string[];
        episode_run_time: number[];
        type: string | null;         // TV: "Miniseries", "Documentary", etc.
        first_air_date: string | null;
        last_air_date: string | null;
    };
}

interface OmdbData {
    imdb_rating: number | null;
    imdb_votes: number | null;
    rotten_tomatoes_rating: number | null;
    metacritic_rating: number | null;
    awards: string | null;
    rated: string | null;
    writer: string | null;
    box_office: string | null;
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchTmdbDiscover(type: 'movie' | 'tv', year: number, page: number) {
    const sort = 'vote_count.desc';
    const yearParam = type === 'movie' ? `primary_release_year=${year}` : `first_air_date_year=${year}`;
    const url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&sort_by=${sort}&page=${page}&${yearParam}&include_adult=false&vote_count.gte=10`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (Discover). Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDiscover(type, year, page);
        }
        throw new Error(`TMDB Discover Error ${res.status}`);
    }
    return await res.json();
}

async function fetchTmdbDetails(type: 'movie' | 'tv', tmdbId: number) {
    const commonAppend = 'credits,videos,images,external_ids,keywords,watch/providers,recommendations';
    const append = type === 'movie'
        ? `${commonAppend},release_dates`
        : `${commonAppend},content_ratings`;

    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=${append}`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (Details). Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDetails(type, tmdbId);
        }
        if (res.status === 404) return null;
        throw new Error(`TMDB Details Error ${res.status}`);
    }
    return await res.json();
}

async function fetchOmdbData(imdbId: string): Promise<OmdbData | null> {
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
            box_office: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
        };
    } catch {
        return null;
    }
}

async function fetchOmdbDataByTitle(title: string, year: number): Promise<OmdbData | null> {
    if (!OMDB_API_KEY) return null;
    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}&tomatoes=true`;
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
            box_office: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
        };
    } catch {
        return null;
    }
}

// ============================================================================
// FRANCHISE DISCOVERY API HELPERS
// ============================================================================

/**
 * Discover all TV shows with a specific TMDB keyword
 * Used for universe detection (e.g., all shows tagged "arrowverse")
 * 
 * @param keywordId - TMDB keyword ID
 * @param maxPages - Maximum pages to fetch (default: 5)
 * @returns Array of TMDB show IDs
 */
export async function discoverByKeyword(keywordId: number, maxPages: number = 5): Promise<number[]> {
    const results: number[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= maxPages) {
        const url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_keywords=${keywordId}&sort_by=first_air_date.asc&page=${page}`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                if (res.status === 429) {
                    console.warn('   ⚠️ Rate limited (Discover by Keyword). Sleeping 5s...');
                    await sleep(5000);
                    continue;
                }
                throw new Error(`TMDB Discover Error ${res.status}`);
            }

            const data = await res.json();
            results.push(...data.results.map((s: any) => s.id));
            totalPages = data.total_pages;
            page++;

        } catch (error) {
            console.error(`Failed to discover by keyword ${keywordId}:`, error);
            break;
        }
    }

    return results;
}

/**
 * Fetch aggregate credits for a TV show (full cast/crew across all seasons)
 * Used for building creator graphs
 * 
 * @param showId - TMDB show ID
 * @returns Array of credits with person ID, name, and role
 */
export async function fetchAggregateCredits(showId: number): Promise<Array<{
    personId: number;
    name: string;
    role: string;
    department: string;
    episodeCount: number;
}>> {
    const url = `${TMDB_BASE_URL}/tv/${showId}/aggregate_credits?api_key=${TMDB_API_KEY}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 429) {
                await sleep(5000);
                return fetchAggregateCredits(showId);
            }
            return [];
        }

        const data = await res.json();
        const credits: Array<{ personId: number; name: string; role: string; department: string; episodeCount: number }> = [];

        // Process crew (creators, writers, directors, producers)
        for (const person of (data.crew || [])) {
            for (const job of (person.jobs || [])) {
                credits.push({
                    personId: person.id,
                    name: person.name,
                    role: job.job,
                    department: person.department || 'Unknown',
                    episodeCount: job.episode_count || 0
                });
            }
        }

        return credits;

    } catch {
        return [];
    }
}

/**
 * Look up a universe by slug and return its UUID
 */
async function lookupUniverseId(
    supabase: ReturnType<typeof createServiceRoleClient>,
    slug: string
): Promise<string | null> {
    const { data, error: _error } = await supabase
        .from('tv_universes')
        .select('id')
        .eq('slug', slug)
        .single();

    if (_error || !data) return null;
    return data.id;
}

/**
 * Detect universe from TMDB keywords and resolve to UUID
 */
async function detectAndResolveUniverse(
    supabase: ReturnType<typeof createServiceRoleClient>,
    keywords?: { id: number; name: string }[]
): Promise<{ universeId: string; slug: string } | null> {
    if (!keywords || keywords.length === 0) return null;

    const keywordIds = keywords.map(k => k.id);
    const match = detectUniverseFromKeywords(keywordIds);

    if (!match) return null;

    const universeId = await lookupUniverseId(supabase, match.slug);
    if (!universeId) return null;

    return { universeId, slug: match.slug };
}

/**
 * Detect parent series from known spinoffs list
 */
async function detectParentSeries(
    supabase: ReturnType<typeof createServiceRoleClient>,
    tmdbId: number
): Promise<string | null> {
    const spinoff = KNOWN_SPINOFFS.find(([childId]) => childId === tmdbId);
    if (!spinoff) return null;

    const [, parentTmdbId] = spinoff;

    // Look up parent by TMDB ID
    const { data } = await supabase
        .from('global_items')
        .select('id')
        .eq('category_type', 'TV_SHOW')
        .contains('external_ids', { tmdb: parentTmdbId })
        .single();

    return data?.id || null;
}


// ============================================================================
// METADATA EXTRACTION
// ============================================================================

function extractMetadata(type: 'movie' | 'tv', details: any): TmdbMetadata {
    const cast = details.credits?.cast?.slice(0, 10).map((c: any) => c.name) || [];
    const crew = details.credits?.crew || [];
    const director = crew.find((c: any) => c.job === 'Director')?.name || null;
    const createdBy = details.created_by?.map((c: any) => c.name) || [];

    const writers = crew.filter((c: any) => ['Screenplay', 'Writer', 'Story'].includes(c.job)).map((c: any) => c.name);
    const tmdbWriter = [...new Set(writers)].slice(0, 3).join(', ') || null;

    const studios = details.production_companies?.map((c: any) => c.name) || [];
    const mainStudio = studios[0] || null;

    let tmdbRating = null;
    if (type === 'movie') {
        const usRelease = details.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
        if (usRelease) {
            const cert = usRelease.release_dates.find((d: any) => d.certification);
            tmdbRating = cert?.certification || null;
        }
    } else {
        const usRating = details.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US');
        tmdbRating = usRating?.rating || null;
    }

    const videos = details.videos?.results || [];
    const trailer = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
    const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

    const backdropPath = details.images?.backdrops?.[0]?.file_path || null;
    const logoPath = details.images?.logos?.find((l: any) => l.iso_639_1 === 'en')?.file_path || null;
    const keywords = details.keywords?.results?.map((k: any) => k.name) || details.keywords?.keywords?.map((k: any) => k.name) || [];
    const socials = details.external_ids || {};
    const watchProviders = details['watch/providers']?.results?.US || null;

    return {
        title: details.title || details.name,
        original_title: details.original_title || details.original_name,
        overview: details.overview,
        tagline: details.tagline || null,
        release_date: details.release_date || details.first_air_date,
        release_year: new Date(details.release_date || details.first_air_date || new Date().toISOString()).getFullYear(),
        status: details.status,
        homepage: details.homepage,
        poster_path: details.poster_path,
        backdrop_path: backdropPath,
        logo_path: logoPath,
        trailer_url: trailerUrl,
        popularity: details.popularity,
        vote_average: details.vote_average,
        vote_count: details.vote_count,
        budget: details.budget || 0,
        revenue: details.revenue || 0,
        runtime: details.runtime || (details.episode_run_time?.length ? details.episode_run_time[0] : 0),
        content_rating: tmdbRating,
        writer: tmdbWriter,
        genres: details.genres?.map((g: any) => g.name) || [],
        keywords: keywords,
        original_language: details.original_language,
        origin_countries: details.origin_country || (details.production_countries?.map((c: any) => c.iso_3166_1) || []),
        spoken_languages: details.spoken_languages?.map((l: any) => l.english_name) || [],
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
            wikidata: socials.wikidata_id,
            facebook: socials.facebook_id,
            instagram: socials.instagram_id,
            twitter: socials.twitter_id,
        },
        watch_providers: watchProviders,
        metadata: {
            created_by: createdBy,
            episode_run_time: details.episode_run_time || [],
            type: details.type || null,  // TV: "Miniseries", "Documentary", etc.
            first_air_date: details.first_air_date || null,
            last_air_date: details.last_air_date || null,
        },
    };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function harvestTmdb(
    supabase: ReturnType<typeof createServiceRoleClient>,
    options: TmdbHarvestOptions
): Promise<HarvestResult> {
    const { type, operation } = options;
    const categoryType = type === 'movie' ? 'MOVIE' : 'TV_SHOW';
    const categoryName = type === 'movie' ? 'Movies' : 'TV Shows';
    const emoji = type === 'movie' ? '🎬' : '📺';

    if (!TMDB_API_KEY) {
        console.error('❌ Missing TMDB_API_KEY');
        return { success: 0, skipped: 0, failed: 0, category: categoryName };
    }

    console.log(`\n${emoji} TMDB ${operation.toUpperCase()} - ${categoryName.toUpperCase()}`);
    console.log('═'.repeat(65));

    if (operation === 'harvest') {
        return harvestNewItems(supabase, type, categoryType, categoryName, options);
    } else {
        return backfillExistingItems(supabase, type, categoryType, categoryName, options);
    }
}

// ============================================================================
// OPERATION: HARVEST (Full discovery of new items)
// ============================================================================

async function harvestNewItems(
    supabase: ReturnType<typeof createServiceRoleClient>,
    type: 'movie' | 'tv',
    categoryType: string,
    categoryName: string,
    options: TmdbHarvestOptions
): Promise<HarvestResult> {
    const startYear = options.startYear ?? new Date().getFullYear();
    const endYear = options.endYear ?? 1970;
    const maxPages = options.maxPages ?? 100;
    const limit = pLimit(CONCURRENCY);
    const imageService = new ImageService('covers');

    console.log(`📋 Config: Years ${startYear}→${endYear}, Max ${maxPages} pages/year`);

    // Build triage map of existing items
    const triageMap = new Map<number, TriageItem>();
    const titleMap = new Map<string, TriageItem>();

    console.log('\n📥 Building triage map...');
    const existingItems: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('global_items')
            .select('id, title, external_ids, category_type')
            .eq('category_type', categoryType)
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
            console.error('❌ Failed to load existing items:', error);
            break;
        }

        if (data && data.length > 0) {
            existingItems.push(...data);
            offset += PAGE_SIZE;
            hasMore = data.length === PAGE_SIZE;
            process.stdout.write(`\r   📦 Loaded ${existingItems.length} items...`);
        } else {
            hasMore = false;
        }
    }
    console.log('');

    existingItems.forEach((row: any) => {
        const triageItem = { id: row.id, isComplete: true };
        const tmdbId = row.external_ids?.tmdb || row.external_ids?.tmdb_tv;
        if (tmdbId) triageMap.set(Number(tmdbId), triageItem);
        if (row.title) {
            const titleKey = `${row.title.toLowerCase()}|${row.category_type}`;
            titleMap.set(titleKey, triageItem);
        }
    });

    console.log(`   ✓ Triage map built: ${triageMap.size} by TMDB ID, ${titleMap.size} by title`);

    let success = 0, skipped = 0, failed = 0;

    // Iterate years
    for (let year = startYear; year >= endYear; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        for (let page = 1; page <= maxPages; page++) {
            try {
                const data = await fetchTmdbDiscover(type, year, page);
                const results = data.results || [];
                if (results.length === 0) break;

                const batch = results.map((item: any) => {
                    const title = item.title || item.name;
                    const titleKey = `${title.toLowerCase()}|${categoryType}`;

                    let status = triageMap.get(item.id);
                    if (!status) status = titleMap.get(titleKey);

                    if (!status) return { taskType: 'NEW', item };
                    return { taskType: 'HEAL', item, id: status.id };
                });

                const newCount = batch.filter((b: any) => b.taskType === 'NEW').length;
                const healCount = batch.filter((b: any) => b.taskType === 'HEAL').length;

                if (newCount === 0 && healCount === 0) {
                    process.stdout.write('.');
                    continue;
                }

                console.log(`   📄 Year ${year} Page ${page}: ${newCount} New, ${healCount} Update`);

                const tasks = batch.map((task: any) => limit(async () => {
                    const result = await processHarvestTask(supabase, type, categoryType, task, imageService, options.dryRun);
                    if (result === 'success') success++;
                    else if (result === 'skipped') skipped++;
                    else failed++;
                }));

                await Promise.all(tasks);
                await sleep(250);

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Page ${page}:`, err);
                await sleep(1000);
            }
        }
    }

    console.log(`\n✅ ${categoryName}: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: categoryName };
}

async function processHarvestTask(
    supabase: ReturnType<typeof createServiceRoleClient>,
    type: 'movie' | 'tv',
    categoryType: string,
    task: any,
    imageService: ImageService,
    dryRun?: boolean
): Promise<'success' | 'skipped' | 'failed'> {
    const tmdbId = task.item.id;
    const title = task.item.title || task.item.name;

    try {
        const details = await fetchTmdbDetails(type, tmdbId);
        if (!details) return 'skipped';

        const meta = extractMetadata(type, details);

        console.log(`\n   ╔═══════════════════════════════════════════════════════════════`);
        console.log(`   ║ ${task.taskType === 'NEW' ? '🆕 NEW' : '🔄 UPDATE'} ${type.toUpperCase()}: ${meta.title}`);
        console.log(`   ╠═══════════════════════════════════════════════════════════════`);
        console.log(`   ║ TMDB: ${tmdbId} | IMDB: ${meta.external_ids.imdb || 'N/A'} | Year: ${meta.release_year}`);
        if (type === 'tv' && meta.metadata.type) {
            console.log(`   ║ Type: ${meta.metadata.type}`);
        }

        // Fetch OMDb data
        const imdbId = meta.external_ids.imdb;
        let omdbData = imdbId ? await fetchOmdbData(imdbId) : null;
        if (!omdbData) {
            omdbData = await fetchOmdbDataByTitle(meta.title, meta.release_year);
        }

        if (omdbData) {
            console.log(`   ║ OMDb: IMDB ${omdbData.imdb_rating || 'N/A'} | RT ${omdbData.rotten_tomatoes_rating || 'N/A'}% | MC ${omdbData.metacritic_rating || 'N/A'}`);
        }

        const finalWriter = omdbData?.writer || meta.writer;
        const finalContentRating = omdbData?.rated || meta.content_rating;
        const finalBoxOffice = omdbData?.box_office || null;
        let imageUrl: string | null = null;
        let description = meta.overview;
        let validTags: { id: string; name: string }[] = [];
        let embeddingVector = null;
        let tvClassification: {
            bucketType: TvBucket;
            genreLens: GenreLens;
            isAnthology: boolean;
            formatType?: TvFormat;
            archetypes?: string;
            franchiseType?: FranchiseType;  // Save the Cat franchise type
            universeId?: string;             // FK to tv_universes
            parentSeriesId?: string;         // FK to parent show (spinoff)
            iabFacets?: IABFacetType[];      // IAB taxonomy for unscripted content
            tvdbEnrichment?: TvdbEnrichmentResult; // TVDB v4 enrichment data
        } | null = null;

        if (task.taskType === 'NEW') {
            // Upload image
            if (meta.poster_path) {
                const rawUrl = `https://image.tmdb.org/t/p/original${meta.poster_path}`;
                imageUrl = await imageService.processAndUpload(rawUrl, type);
                if (imageUrl) console.log(`   ║ 🖼️ Image uploaded`);
            }

            // ================================================================
            // TV-SPECIFIC ENRICHMENT (Per Blueprint + Semantic Density)
            // ================================================================
            if (type === 'tv') {
                console.log(`   ║ 🧠 Generating TV-specific description (3-Bucket + 6-Format)...`);

                // ================================================================
                // TVDB v4 ENRICHMENT (Characters, Tags, Franchises)
                // ================================================================
                let tvdbEnrichment: TvdbEnrichmentResult | undefined;
                const tvdbId = details.external_ids?.tvdb_id;
                if (tvdbId) {
                    const tvdbApiKey = await SystemConfigService.getDecryptedConfig('tvdb_api_key');
                    const tvdbPin = await SystemConfigService.getDecryptedConfig('tvdb_pin');
                    if (tvdbApiKey) {
                        const tvdbSeries = await getSeriesExtended(tvdbId, tvdbApiKey, tvdbPin || undefined);
                        if (tvdbSeries) {
                            tvdbEnrichment = extractEnrichment(tvdbSeries);
                            console.log(`   ║ 📺 TVDB: ${tvdbEnrichment.semanticTags.length} tags, ${tvdbEnrichment.characters.length} characters, ${tvdbEnrichment.officialLists.length} lists`);

                            // Check for anime absolute ordering
                            if (isAnime(tvdbSeries)) {
                                const absoluteCount = await getAbsoluteEpisodeCount(tvdbId, tvdbApiKey, tvdbPin || undefined);
                                if (absoluteCount > 0) {
                                    tvdbEnrichment.absoluteEpisodeCount = absoluteCount;
                                    console.log(`   ║ 🎌 Anime detected: ${absoluteCount} absolute episodes`);
                                }
                            }
                        }
                    }
                }

                // Detect bucket and lens (pass TMDB type for strongest signal)
                const bucketType = detectTvBucket(meta.genres, meta.keywords, meta.overview, meta.metadata.type);
                const genreLens = detectGenreLens(meta.genres, meta.keywords);
                const anthology = isAnthology(meta.keywords, meta.overview);
                const showrunner = inferShowrunner({
                    created_by: meta.metadata.created_by,
                    directors: meta.director ? [meta.director] : [],
                    writers: meta.writer ? [meta.writer] : []
                });

                // NEW: Detect granular 6-label format type
                const formatType = detectTvFormat(bucketType, meta.genres, meta.keywords, meta.overview, meta.metadata.type);

                console.log(`   ║    Bucket: ${bucketType} | Format: ${formatType} | Lens: ${genreLens}${anthology ? ' | Anthology' : ''}`);
                if (showrunner) console.log(`   ║    Showrunner: ${showrunner}`);

                // Build cast with characters from TMDB credits
                const castWithCharacters = details.credits?.cast?.slice(0, 8).map((c: any) => ({
                    name: c.name,
                    character: c.character || ''
                })) || [];

                // Get LLM config early for archetype translation
                const llmConfig = await getLLMConfig(supabase);

                // Translate characters to archetypes
                let archetypes = '';
                if (castWithCharacters.length >= 2) {
                    console.log(`   ║ 🎭 Translating ${castWithCharacters.length} characters to archetypes...`);
                    archetypes = await aiLimiter(() => translateToArchetypes(
                        llmConfig,
                        meta.title,
                        meta.overview || '',
                        castWithCharacters
                    ));
                    if (archetypes) console.log(`   ║    ✓ Archetypes: ${archetypes.slice(0, 80)}...`);
                }

                // NEW: Classify franchise type (Save the Cat methodology)
                console.log(`   ║ 📚 Classifying franchise type...`);
                const franchiseType = await aiLimiter(() => classifyFranchiseType(
                    llmConfig,
                    meta.title,
                    meta.overview || ''
                ));
                console.log(`   ║    ✓ Franchise: ${franchiseType}`);

                // Generate TV-specific structured description
                const descResult = await aiLimiter(() => generateTvShowDescription(supabase, {
                    title: meta.title,
                    type: 'TV_SHOW',
                    originalDescription: meta.overview,
                    genres: meta.genres,
                    keywords: meta.keywords,
                    networks: meta.networks,
                    castWithCharacters
                }));

                // Format description for UI (premise + themes + tone)
                const descParts = [
                    descResult.premise,
                    descResult.themes,
                    descResult.tone
                ].filter(Boolean);
                description = descParts.join('\n\n');
                console.log(`   ║    ✓ Description generated (${bucketType}/${formatType}/${genreLens})`);

                // Generate TV-specific tags using 4-bucket taxonomy
                const aiTagNames = await aiLimiter(() => generateTvShowTags(llmConfig, meta.title, description));

                // Merge TVDB semantic tags with LLM-generated tags
                // TVDB tags are curated, so they ground the AI output
                let finalTagNames = [...aiTagNames];
                if (tvdbEnrichment && tvdbEnrichment.semanticTags.length > 0) {
                    // Add TVDB tags that aren't already in the list
                    const existingNormalized = new Set(aiTagNames.map(t => t.toLowerCase()));
                    const tvdbUnique = tvdbEnrichment.semanticTags
                        .filter(t => !existingNormalized.has(t.toLowerCase()))
                        .slice(0, 10); // Limit new tags
                    if (tvdbUnique.length > 0) {
                        finalTagNames = [...aiTagNames, ...tvdbUnique];
                        console.log(`   ║ 🎯 Merged ${tvdbUnique.length} TVDB tags with LLM tags`);
                    }
                }
                validTags = await ensureTags(supabase, finalTagNames);
                console.log(`   ║ 🏷️ ${finalTagNames.length} TV tags (4-bucket + TVDB)`);

                // Build SUPER-DOCUMENT vector text (Semantic Media Intelligence)
                // Includes: Franchise Type, Format Type, Archetypes, 1024 token limit
                const vectorText = buildTvShowVectorText({
                    title: meta.title,
                    release_year: meta.release_year,
                    genres: meta.genres,
                    keywords: meta.keywords,
                    tags: {
                        sub_genres: finalTagNames.slice(0, 5),
                        tropes: finalTagNames.slice(5, 11),
                        mood: finalTagNames.slice(11, 16),
                        format: finalTagNames.slice(16, 20)
                    },
                    description_parts: {
                        themes: descResult.themes
                    },
                    semanticSummary: descResult.semanticSummary,
                    bucketType,
                    genreLens,
                    formatType,
                    archetypes,
                    franchiseType    // NEW: Save the Cat franchise type
                });

                // ANTHOLOGY DETECTION: Use synthetic centroid for anthology shows
                // Combines series overview + top episode descriptions for richer embedding
                if (anthology && details.seasons?.length > 0) {
                    console.log(`   ║ 📚 Anthology detected - using Synthetic Centroid strategy`);
                    // Fetch episode data for synthetic centroid (top 3 by popularity)
                    const episodes: AnthologyEpisode[] = details.seasons
                        .flatMap((s: { episode_count?: number; name?: string; overview?: string }) =>
                            s.episode_count ? [{ name: s.name || 'Unknown', overview: s.overview || '', vote_count: s.episode_count }] : []
                        )
                        .slice(0, 5);
                    if (episodes.length > 0) {
                        embeddingVector = await generateAnthologySyntheticCentroid(
                            descResult.semanticSummary || details.overview || '',
                            episodes
                        );
                    } else {
                        embeddingVector = await generateEmbedding(vectorText);
                    }
                } else {
                    embeddingVector = await generateEmbedding(vectorText);
                }
                if (embeddingVector) console.log(`   ║ 🧮 Embedding generated (${anthology ? 'Synthetic Centroid' : 'Super-Document'})`);

                // Store classification metadata for later payload assignment
                tvClassification = {
                    bucketType,
                    genreLens,
                    isAnthology: anthology,
                    formatType,
                    archetypes,
                    franchiseType,
                    tvdbEnrichment // Store TVDB enrichment data
                };

                // PRIORITY 1: Detect universe from TVDB Official Lists (highest accuracy)
                // e.g., "Breaking Bad Franchise", "Arrowverse", "Star Trek Saga"
                if (tvdbEnrichment && tvdbEnrichment.officialLists.length > 0) {
                    const tvdbUniverseSlug = detectUniverseFromOfficialLists(tvdbEnrichment.officialLists);
                    if (tvdbUniverseSlug) {
                        // Try to find or create the universe
                        const { data: existingUniverse } = await supabase
                            .from('tv_universes')
                            .select('id')
                            .eq('slug', tvdbUniverseSlug)
                            .single();

                        if (existingUniverse) {
                            tvClassification.universeId = existingUniverse.id;
                            console.log(`   ║ 🎯 TVDB Universe (Direct): ${tvdbUniverseSlug}`);
                        } else {
                            console.log(`   ║ 📋 TVDB Universe candidate: ${tvdbUniverseSlug} (not in DB yet)`);
                        }
                    }
                }

                // PRIORITY 2: Detect universe from TMDB keywords (fallback)
                const rawKeywords = details.keywords?.results || [];
                if (!tvClassification.universeId) {
                    const universeMatch = await detectAndResolveUniverse(supabase, rawKeywords);
                    if (universeMatch) {
                        tvClassification.universeId = universeMatch.universeId;
                        console.log(`   ║ 🌌 Universe detected: ${universeMatch.slug}`);
                    }
                }

                // NEW: Detect parent series (spinoffs)
                const parentSeriesId = await detectParentSeries(supabase, tmdbId);
                if (parentSeriesId) {
                    tvClassification.parentSeriesId = parentSeriesId;
                    console.log(`   ║ 👨‍👦 Parent series detected`);
                }

                // NEW: Wikidata federation - fallback universe detection
                const wikidataId = details.external_ids?.wikidata_id;
                if (wikidataId && !tvClassification.universeId) {
                    try {
                        console.log(`   ║ 🔎 Querying Wikidata (${wikidataId})...`);
                        const wikiRels = await fetchWikidataRelationships(wikidataId);

                        // Check if Wikidata knows a universe (wikiRels can be null from cache)
                        if (wikiRels && (wikiRels.narrativeUniverse || wikiRels.partOfSeries)) {
                            const wikiUniverseQid = wikiRels.narrativeUniverse || wikiRels.partOfSeries;
                            const resolvedSlug = resolveWikidataUniverseSlug(wikiUniverseQid);
                            if (resolvedSlug) {
                                // Look up our internal universe ID
                                const { data: universeData } = await supabase
                                    .from('tv_universes')
                                    .select('id')
                                    .eq('slug', resolvedSlug)
                                    .single();
                                if (universeData) {
                                    tvClassification.universeId = universeData.id;
                                    console.log(`   ║ 🌌 Wikidata universe: ${resolvedSlug}`);
                                }
                            }
                        }
                    } catch (wikiErr) {
                        console.warn(`   ║ ⚠️ Wikidata lookup failed:`, wikiErr);
                    }
                }

                // NEW: Detect IAB facets for unscripted content (FORMAT/OBSERVATIONAL buckets)
                if (bucketType === 'FORMAT' || bucketType === 'OBSERVATIONAL') {
                    const keywordStrings = rawKeywords.map((k: { name: string }) => k.name);
                    const genreIds = details.genres?.map((g: { id: number }) => g.id) || [];
                    const iabFacets = detectIABFacets(genreIds, keywordStrings);
                    if (iabFacets.length > 0) {
                        tvClassification.iabFacets = iabFacets;
                        console.log(`   ║ 📊 IAB Facets: ${iabFacets.join(', ')}`);
                    }
                }

            } else {
                // ================================================================
                // MOVIE ENRICHMENT (Generic path)
                // ================================================================
                console.log(`   ║ 🧠 Generating AI description...`);
                const richContext = `Title: ${meta.title} (${meta.release_year})\nDirector: ${meta.director || 'N/A'}\nWriter: ${finalWriter || 'N/A'}\nCast: ${meta.cast.slice(0, 5).join(', ')}\nGenres: ${meta.genres.join(', ')}\nKeywords: ${meta.keywords.join(', ')}\nOverview: ${meta.overview || 'N/A'}`;
                description = await aiLimiter(() => rewriteDescription(supabase, meta.title, richContext, categoryType));
                console.log(`   ║    ✓ Description generated`);

                // Generate tags
                const tagInput = [...(meta.keywords || []), ...meta.genres].join(', ');
                const aiTagNames = await aiLimiter(() => generateTags(supabase, meta.title, `${description} Keywords: ${tagInput}`, categoryType));
                validTags = await ensureTags(supabase, aiTagNames);
                console.log(`   ║ 🏷️ ${aiTagNames.length} tags generated`);

                // Generate embedding
                const vectorText = `Title: ${meta.title}\nRating: ${omdbData?.rotten_tomatoes_rating || meta.vote_average}\nDirector: ${meta.director || 'Unknown'}\nWriter: ${finalWriter || 'Unknown'}\nKeywords: ${meta.keywords.slice(0, 10).join(', ')}\nPlot: ${description}`;
                embeddingVector = await generateEmbedding(vectorText);
                if (embeddingVector) console.log(`   ║ 🧮 Embedding generated`);
            }
        }

        if (dryRun) {
            console.log(`   ║ 🏃 DRY RUN - Skipping database write`);
            console.log(`   ╚═══════════════════════════════════════════════════════════════\n`);
            return 'skipped';
        }

        // Build payload
        const basePayload = {
            title: meta.title,
            category_type: categoryType,
            release_year: meta.release_year,
            runtime: meta.runtime,
            trailer_url: meta.trailer_url,
            tagline: meta.tagline,
            content_rating: finalContentRating,
            writer: finalWriter,
            box_office: finalBoxOffice,
            vote_average: meta.vote_average,
            imdb_rating: omdbData?.imdb_rating || null,
            imdb_votes: omdbData?.imdb_votes || null,
            rotten_tomatoes_rating: omdbData?.rotten_tomatoes_rating || null,
            metacritic_rating: omdbData?.metacritic_rating || null,
            awards_text: omdbData?.awards || null,
            original_title: meta.original_title,
            status: meta.status,
            homepage: meta.homepage,
            budget: meta.budget,
            revenue: meta.revenue,
            original_language: meta.original_language,
            spoken_languages: meta.spoken_languages,
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

        if (task.taskType === 'NEW') {
            const insertPayload = {
                ...basePayload,
                description,
                image_url: imageUrl,
                cached_tags: validTags,
                vector_text: JSON.stringify(embeddingVector),
                // TV-specific classification fields (Semantic Media Intelligence)
                ...(tvClassification ? {
                    bucket_type: tvClassification.bucketType,
                    genre_lens: tvClassification.genreLens,
                    is_anthology: tvClassification.isAnthology,
                    format_type: tvClassification.formatType,
                    archetypes: tvClassification.archetypes || null,
                    franchise_type: tvClassification.franchiseType,
                    universe_id: tvClassification.universeId || null,
                    parent_series_id: tvClassification.parentSeriesId || null
                } : {})
            };

            const { error } = await (supabase.from('global_items') as any).insert(insertPayload);
            if (error) {
                console.log(`   ║ ❌ Insert error: ${error.message}`);
                console.log(`   ╚═══════════════════════════════════════════════════════════════\n`);
                return 'failed';
            }
        } else {
            // HEAL: Update metadata only (preserve description, tags, image)
            const { error } = await (supabase.from('global_items') as any).update(basePayload).eq('id', task.id);
            if (error) {
                console.log(`   ║ ❌ Update error: ${error.message}`);
                console.log(`   ╚═══════════════════════════════════════════════════════════════\n`);
                return 'failed';
            }
        }

        console.log(`   ║ ✅ Saved to database`);
        console.log(`   ╚═══════════════════════════════════════════════════════════════\n`);
        return 'success';

    } catch (error) {
        console.error(`   ❌ Processing error for "${title}":`, error);
        return 'failed';
    }
}

// ============================================================================
// OPERATION: BACKFILL (Smart update of existing items)
// ============================================================================

async function backfillExistingItems(
    supabase: ReturnType<typeof createServiceRoleClient>,
    type: 'movie' | 'tv',
    categoryType: string,
    categoryName: string,
    options: TmdbHarvestOptions
): Promise<HarvestResult> {
    const limit = options.limit ?? 1000;
    const dryRun = options.dryRun ?? false;
    const externalIdKey = type === 'movie' ? 'tmdb' : 'tmdb_tv';

    console.log(`📋 Config: Backfill up to ${limit} items, dryRun=${dryRun}`);

    // Find items with missing metadata
    // For TV shows, we specifically target items missing the 'type' field
    console.log('\n🔍 Finding items with missing metadata...');

    const { data: items, error } = await supabase
        .from('global_items')
        .select('id, title, external_ids, metadata')
        .eq('category_type', categoryType)
        .limit(limit);

    if (error) {
        console.error('❌ Failed to fetch items:', error);
        return { success: 0, skipped: 0, failed: 0, category: categoryName };
    }

    if (!items || items.length === 0) {
        console.log('   ℹ️ No items found to backfill');
        return { success: 0, skipped: 0, failed: 0, category: categoryName };
    }

    // Filter to items that need backfill (missing key fields)
    const needsBackfill = items.filter((item: any) => {
        if (type === 'tv') {
            // For TV: backfill if missing 'type' in metadata
            return !item.metadata?.type;
        } else {
            // For movies: backfill if missing key ratings
            return !item.metadata?.imdb_rating && !item.metadata?.rotten_tomatoes_rating;
        }
    });

    console.log(`   Found ${needsBackfill.length}/${items.length} items needing backfill`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < needsBackfill.length; i++) {
        const item = needsBackfill[i] as any;
        const tmdbId = item.external_ids?.[externalIdKey] || item.external_ids?.tmdb;

        if (!tmdbId) {
            console.log(`   ⏭️ Skipping "${item.title}" - No TMDB ID`);
            skipped++;
            continue;
        }

        console.log(`\n   [${i + 1}/${needsBackfill.length}] 🔄 Backfilling: ${item.title}`);

        try {
            const details = await fetchTmdbDetails(type, tmdbId);
            if (!details) {
                console.log(`      ⚠️ No TMDB details found`);
                skipped++;
                continue;
            }

            const meta = extractMetadata(type, details);

            // Fetch OMDb for ratings
            const imdbId = meta.external_ids.imdb;
            let omdbData = imdbId ? await fetchOmdbData(imdbId) : null;
            if (!omdbData) {
                omdbData = await fetchOmdbDataByTitle(meta.title, meta.release_year);
            }

            // Build smart update payload - only update missing fields
            const updatePayload: Record<string, any> = {
                metadata: {
                    ...(item.metadata || {}),
                    ...meta.metadata,  // This includes 'type' for TV shows
                },
                last_metadata_update: new Date().toISOString(),
            };

            // Add OMDb ratings if available and missing
            if (omdbData) {
                if (!item.imdb_rating && omdbData.imdb_rating) updatePayload.imdb_rating = omdbData.imdb_rating;
                if (!item.imdb_votes && omdbData.imdb_votes) updatePayload.imdb_votes = omdbData.imdb_votes;
                if (!item.rotten_tomatoes_rating && omdbData.rotten_tomatoes_rating) updatePayload.rotten_tomatoes_rating = omdbData.rotten_tomatoes_rating;
                if (!item.metacritic_rating && omdbData.metacritic_rating) updatePayload.metacritic_rating = omdbData.metacritic_rating;
                if (!item.awards_text && omdbData.awards) updatePayload.awards_text = omdbData.awards;
            }

            // Add TV-specific fields
            if (type === 'tv') {
                if (!item.number_of_seasons && meta.number_of_seasons) updatePayload.number_of_seasons = meta.number_of_seasons;
                if (!item.number_of_episodes && meta.number_of_episodes) updatePayload.number_of_episodes = meta.number_of_episodes;
                if (meta.metadata.type) console.log(`      Type: ${meta.metadata.type}`);

                // TVDB enrichment for TV shows (same logic as harvest)
                const tvdbId = details.external_ids?.tvdb_id;
                if (tvdbId) {
                    const tvdbApiKey = await SystemConfigService.getDecryptedConfig('tvdb_api_key');
                    const tvdbPin = await SystemConfigService.getDecryptedConfig('tvdb_pin');
                    if (tvdbApiKey) {
                        const tvdbSeries = await getSeriesExtended(tvdbId, tvdbApiKey, tvdbPin || undefined);
                        if (tvdbSeries) {
                            const tvdbEnrichment = extractEnrichment(tvdbSeries);
                            console.log(`      📺 TVDB: ${tvdbEnrichment.semanticTags.length} tags, ${tvdbEnrichment.characters.length} characters`);

                            // Store TVDB enrichment in metadata
                            updatePayload.metadata = {
                                ...updatePayload.metadata,
                                tvdb_enrichment: {
                                    semantic_tags: tvdbEnrichment.semanticTags,
                                    characters: tvdbEnrichment.characters.slice(0, 10), // Top 10
                                    official_lists: tvdbEnrichment.officialLists,
                                    content_rating: tvdbEnrichment.contentRating,
                                }
                            };

                            // Check for anime
                            if (isAnime(tvdbSeries)) {
                                const absoluteCount = await getAbsoluteEpisodeCount(tvdbId, tvdbApiKey, tvdbPin || undefined);
                                if (absoluteCount > 0) {
                                    updatePayload.metadata.absolute_episode_count = absoluteCount;
                                    console.log(`      🎌 Anime: ${absoluteCount} absolute episodes`);
                                }
                            }
                        }
                    }
                }
            }

            if (dryRun) {
                console.log(`      🏃 DRY RUN - Would update:`, Object.keys(updatePayload).join(', '));
                skipped++;
                continue;
            }

            const { error: updateError } = await (supabase.from('global_items') as any).update(updatePayload).eq('id', item.id);
            if (updateError) {
                console.log(`      ❌ Update failed: ${updateError.message}`);
                failed++;
            } else {
                console.log(`      ✅ Updated`);
                success++;
            }

            await sleep(250);  // Rate limit

        } catch (err) {
            console.error(`      ❌ Error:`, err);
            failed++;
        }
    }

    console.log(`\n✅ ${categoryName} Backfill: ${success} updated, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: categoryName };
}
