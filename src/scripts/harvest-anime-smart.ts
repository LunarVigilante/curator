
import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, upsertItem, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';

// Config
const START_YEAR = 2026;
const END_YEAR = 1980;
const MAX_PAGES = 10; // Top 500 items per year is usually plenty
const CONCURRENCY = 5;
const ANILIST_API_URL = 'https://graphql.anilist.co';
// AniList Rate Limit: 90 req/min => 1.5 req/sec. 
// Since we fetch 50 items per request, we are very safe on API hits, 
// but we should still respect a delay to be polite and avoid bursts.
const PAGE_DELAY_MS = 2000;

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// Types
interface TriageItem {
    id: string; // Supabase UUID
    isComplete: boolean;
}

// Map<anilist_id, TriageItem>
const triageMap = new Map<number, TriageItem>();
// Map<lower(title)+category_type, TriageItem> for title-based lookup
const titleMap = new Map<string, TriageItem>();

// GraphQL Query (Rich Fetch)
const RICH_ANIME_QUERY = `
query ($page: Int, $year: Int) {
    Page (page: $page, perPage: 50) {
        pageInfo {
            hasNextPage
        }
        media (
            seasonYear: $year, 
            type: ANIME, 
            sort: POPULARITY_DESC, 
            format_in: [TV, MOVIE, OVA, ONA], 
            isAdult: false
        ) {
            id
            title {
                romaji
                english
                native
            }
            description(asHtml: false)
            coverImage {
                extraLarge
            }
            season
            seasonYear
            episodes
            source
            genres
            averageScore
            popularity
            status
            countryOfOrigin
            startDate { year }
            
            # Metadata for extraction
            trailer {
                site
                id
            }
            studios(isMain: true) {
                nodes {
                    name
                }
            }
            staff(perPage: 10) { 
                edges {
                    role
                    node {
                        name { full }
                    }
                }
            }
            characters(sort: ROLE, perPage: 6) {
                edges {
                    voiceActors(language: JAPANESE, sort: RELEVANCE) {
                        name { full }
                    }
                }
            }
        }
    }
}
`;

// ============================================================================
// HELPERS
// ============================================================================

async function fetchAniList(year: number, page: number) {
    const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: RICH_ANIME_QUERY,
            variables: { page, year }
        })
    });

    if (!response.ok) {
        if (response.status === 429) {
            console.warn('   ⚠️ Rate limited. Sleeping 60s...');
            await sleep(60000);
            return fetchAniList(year, page);
        }
        throw new Error(`AniList Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

function extractMetadata(anime: any) {
    // 1. Studio (First main studio)
    const studio = anime.studios?.nodes?.[0]?.name || null;

    // 2. Staff (Director, Writer, Creator)
    let director = null;
    let originalCreator = null;
    let writer = null;

    if (anime.staff?.edges) {
        for (const edge of anime.staff.edges) {
            const role = edge.role?.toLowerCase() || '';
            const name = edge.node?.name?.full;
            if (!name) continue;

            if (!director && role.includes('director')) director = name;
            if (!originalCreator && (role.includes('creator') || role.includes('mangaka'))) originalCreator = name;
            if (!writer && (role.includes('script') || role.includes('series composition'))) writer = name;
        }
    }

    // 3. Cast (Japanese Voice Actors)
    const cast = new Set<string>();
    if (anime.characters?.edges) {
        for (const edge of anime.characters.edges) {
            const va = edge.voiceActors?.[0]?.name?.full;
            if (va) cast.add(va);
        }
    }
    const castArray = Array.from(cast).slice(0, 5); // Start with top 5

    // 4. Trailer
    const trailer = anime.trailer?.site === 'youtube' && anime.trailer?.id
        ? `https://www.youtube.com/watch?v=${anime.trailer.id}`
        : null;

    // 5. Season String
    const seasonStr = (anime.season && anime.seasonYear)
        ? `${anime.season} ${anime.seasonYear}`
        : (anime.seasonYear ? `${anime.seasonYear}` : null);

    // 6. Vote Average (0-100 -> 0-10)
    const voteAvg = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

    // 7. Title Preference: English -> Romaji -> Native
    // User requested "romaji_title" column, so we explicitly store that.
    // Ideally title is English if available, else Romaji.
    const displayTitle = anime.title?.english || anime.title?.romaji || anime.title?.native;

    // 8. Country & Language Mapping
    const countryToLang: Record<string, string> = { 'JP': 'ja', 'CN': 'zh', 'KR': 'ko', 'TW': 'zh' };
    const originCountry = anime.countryOfOrigin ? [anime.countryOfOrigin] : [];
    const originalLanguage = anime.countryOfOrigin ? (countryToLang[anime.countryOfOrigin] || 'en') : 'ja';

    return {
        studio,
        director,
        original_creator: originalCreator || writer, // Fallback if no specific creator
        writer,
        cast: castArray,
        trailer_url: trailer,
        season: seasonStr,
        vote_average: voteAvg ? parseFloat(voteAvg) : null,
        episodes: anime.episodes,
        source_material: anime.source, // Using 'source_material' column to avoid 'source' conflict
        genres: anime.genres || [],
        romaji_title: anime.title?.romaji,
        // New Fields
        origin_countries: originCountry,
        original_language: originalLanguage,
        // Base
        title: displayTitle,
        description_raw: anime.description?.replace(/<[^>]*>/g, '') || '', // Strip HTML
        popularity: anime.popularity,
        release_year: anime.startDate?.year || anime.seasonYear,
        cover_image: anime.coverImage?.extraLarge
    };
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function startHarvest() {
    console.log(`🚀 STARTING SMART ANIME HARVEST (ANILIST)`);
    console.log(`   📅 Years: ${START_YEAR} -> ${END_YEAR}`);
    console.log(`   ⚡ Concurrency: ${CONCURRENCY}`);

    // 1. Build Triage Map
    console.log(`\n📥 Building Triage Map from DB...`);

    // Fetch ALL anime items to catch title-based duplicates
    const { data: existingItems, error } = await supabase
        .from('global_items')
        .select('id, title, external_ids, studio, category_type')
        .eq('category_type', 'ANIME');

    if (error) {
        console.error('❌ Failed to load existing items:', error);
        process.exit(1);
    }

    let completeCount = 0;
    let incompleteCount = 0;

    existingItems.forEach((row: any) => {
        const isComplete = !!row.studio;
        const triageItem = { id: row.id, isComplete };

        // Index by external_id if present
        if (row.external_ids?.anilist) {
            triageMap.set(Number(row.external_ids.anilist), triageItem);
        }

        // Also index by title+category for title-based lookup
        if (row.title) {
            const titleKey = `${row.title.toLowerCase()}|ANIME`;
            titleMap.set(titleKey, triageItem);
        }

        if (isComplete) completeCount++;
        else incompleteCount++;
    });

    console.log(`   ✅ Loaded ${existingItems.length} items (${triageMap.size} by ID, ${titleMap.size} by title).`);
    console.log(`   📊 Stats: ${completeCount} Complete (Skip), ${incompleteCount} Incomplete (Heal).`);

    // 2. Iterate Years
    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const data = await fetchAniList(year, page);
                const results = data.data?.Page?.media || [];

                if (results.length === 0) {
                    console.log(`   ⚠️ No more results for ${year} page ${page}. Next year.`);
                    break;
                }

                // Triage Batch - check both external_id AND title
                const batch = results.map((anime: any) => {
                    const title = anime.title?.english || anime.title?.romaji || anime.title?.native;
                    const titleKey = `${title?.toLowerCase() || ''}|ANIME`;

                    // First check by external_id
                    let status = triageMap.get(anime.id);

                    // If not found by ID, check by title
                    if (!status && title) {
                        status = titleMap.get(titleKey);
                    }

                    if (!status) return { type: 'NEW', anime };
                    if (!status.isComplete) return { type: 'HEAL', anime, id: status.id };
                    return { type: 'SKIP', anime };
                });

                const newCount = batch.filter((b: any) => b.type === 'NEW').length;
                const healCount = batch.filter((b: any) => b.type === 'HEAL').length;
                const skipCount = batch.filter((b: any) => b.type === 'SKIP').length;

                if (newCount === 0 && healCount === 0) {
                    process.stdout.write('.'); // Compact progress
                    continue;
                }

                console.log(`   📄 Year ${year} Page ${page}: ${newCount} New, ${healCount} Heal, ${skipCount} Skip`);

                // Concurrent Processing
                const tasks = batch.map((task: any) => limit(async () => {
                    if (task.type === 'SKIP') return;

                    // Rate limiting/throttling per task is NOT needed for extraction since we have all data.
                    // Only Image Download hits network, which handles its own load.
                    // So we just run.
                    await processTask(task, year);
                }));

                await Promise.all(tasks);

                // Delay between PAGES to respect API rate limit (90/min)
                await sleep(PAGE_DELAY_MS);

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Page ${page}:`, err);
                await sleep(5000);
            }
        }
    }
    console.log('\n✅ SMART HARVEST COMPLETE');
}

async function processTask(task: any, year: number) {
    const anime = task.anime;
    const anilistId = anime.id;
    const meta = extractMetadata(anime);

    try {
        // ============================================
        // SCENARIO A: NEW ITEM
        // ============================================
        if (task.type === 'NEW') {
            // 1. Image
            let imageUrl: string | null = null;
            if (meta.cover_image) {
                imageUrl = await imageService.processAndUpload(meta.cover_image, 'anime');
            }

            // 2. AI Description
            const categoryType = 'ANIME';
            const baseDesc = meta.description_raw || `${meta.title} (${year}, ${meta.genres.join(', ')})`;

            const description = await aiLimiter(() =>
                rewriteDescription(supabase, meta.title, baseDesc, categoryType)
            );

            // 3. Tags & Embeddings
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, meta.title, description, categoryType)
            );
            const validTags = await ensureTags(supabase, tagNames);
            const embedding = await generateEmbedding(`${meta.title}: ${description}`);

            // 4. Construct Item
            const newItem = {
                title: meta.title,
                description: description,
                image_url: imageUrl,
                category_type: categoryType,
                external_ids: { anilist: anilistId },
                metadata: {
                    source: `anilist_smart`, // Provenance
                    original_description: meta.description_raw,
                    popularity: meta.popularity,
                    score: anime.averageScore
                },
                cached_tags: validTags,
                // Rich Metadata
                release_year: meta.release_year,
                original_language: meta.original_language,
                origin_countries: meta.origin_countries,
                cast: meta.cast,
                director: meta.director,
                writer: meta.writer,
                original_creator: meta.original_creator,
                studio: meta.studio,
                genres: meta.genres,
                episodes: meta.episodes,
                season: meta.season,
                source_material: meta.source_material,
                romaji_title: meta.romaji_title,
                vote_average: meta.vote_average,
                trailer_url: meta.trailer_url,

                ...(embedding ? { vector_text: JSON.stringify(embedding) } : {})
            };

            const { error } = await supabase.from('global_items').insert(newItem as any);
            if (error) throw error;

            triageMap.set(anilistId, { id: 'pending-uuid', isComplete: true });

            // ============================================
            // SCENARIO B: HEAL (UPDATE METADATA ONLY)
            // ============================================
        } else if (task.type === 'HEAL') {

            const updatePayload = {
                // Backfill external_id if missing
                external_ids: { anilist: anilistId },
                original_language: meta.original_language,
                origin_countries: meta.origin_countries,
                cast: meta.cast,
                director: meta.director,
                writer: meta.writer,
                original_creator: meta.original_creator,
                studio: meta.studio,
                genres: meta.genres,
                episodes: meta.episodes,
                season: meta.season,
                source_material: meta.source_material,
                romaji_title: meta.romaji_title,
                vote_average: meta.vote_average,
                trailer_url: meta.trailer_url,

                last_metadata_update: new Date().toISOString()
            };

            const { error } = await (supabase
                .from('global_items') as any)
                .update(updatePayload)
                .eq('id', task.id);

            if (error) throw error;

            triageMap.set(anilistId, { id: task.id, isComplete: true });
        }

    } catch (error) {
        console.error(`     ❌ Failed processing ${meta.title} (${anilistId}):`, error);
    }
}

startHarvest().catch(console.error);
