
import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, upsertItem, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';
import { HarvestItem } from '@/lib/harvesters/shared';

// Config
const START_YEAR = 2026;
const END_YEAR = 1980;
const MAX_PAGES = 5; // Top 5 pages (250 items) per year
const PER_PAGE = 50;
const CONCURRENCY = 5;
const ANILIST_API_URL = 'https://graphql.anilist.co';
const API_DELAY_MS = 1000; // Rate limit 90/min -> ~666ms, safe with 1s

const supabase = createServiceRoleClient();
// Initialize ImageService with 'covers' bucket as requested
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// GraphQL Query
const ANIME_QUERY = `
query ($page: Int, $year: Int) {
    Page (page: $page, perPage: 50) {
        pageInfo {
            hasNextPage
        }
        media (seasonYear: $year, type: ANIME, sort: POPULARITY_DESC, format_in: [TV, MOVIE, OVA, ONA], isAdult: false) {
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
            startDate {
                year
            }
            averageScore
            popularity
            genres
            episodes
            status
            studios(isMain: true) {
                nodes {
                    name
                }
            }
        }
    }
}
`;

async function fetchAniList(year: number, page: number) {
    const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: ANIME_QUERY,
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

async function startHarvest() {
    console.log(`🚀 STARTING MASSIVE ANIME HARVEST (AniList)`);
    console.log(`   📅 Years: ${START_YEAR} -> ${END_YEAR}`);
    console.log(`   📄 Pages per year: ${MAX_PAGES} (Top ${MAX_PAGES * PER_PAGE} items)`);
    console.log(`   ⚡ Concurrency: ${CONCURRENCY}`);

    // 1. Load Existing IDs for correct Skip Logic
    console.log(`\n📥 Fetching all existing Anime IDs from DB...`);
    const { data: existingItems, error } = await supabase
        .from('global_items')
        .select('external_ids')
        .not('external_ids', 'is', null);

    if (error) {
        console.error('❌ Failed to load existing items:', error);
        process.exit(1);
    }

    const existingIds = new Set<number>();
    existingItems.forEach((row: any) => {
        if (row.external_ids?.anilist) {
            existingIds.add(Number(row.external_ids.anilist));
        }
    });

    console.log(`   ✅ Loaded ${existingIds.size} existing items. Strict skipping enabled.`);

    // 2. Iterate Years
    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const data = await fetchAniList(year, page);
                const results = data.data?.Page?.media || [];

                if (results.length === 0) {
                    console.log(`   ⚠️ No more results for ${year} page ${page}. Breaking year loop.`);
                    break;
                }

                const newItems = results.filter((item: any) => !existingIds.has(item.id));
                const skippedCount = results.length - newItems.length;

                if (newItems.length === 0) {
                    process.stdout.write('.'); // Compact progress for skipped pages
                    continue;
                }

                console.log(`   📄 Year ${year} Page ${page}: Found ${results.length} items (${skippedCount} skipped, ${newItems.length} new)`);

                // Process new items concurrently
                const tasks = newItems.map((anime: any) => limit(async () => {
                    await processItem(anime, year);
                }));

                await Promise.all(tasks);

                // Rate limiting between pages
                await sleep(API_DELAY_MS);

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Page ${page}:`, err);
                await sleep(2000);
            }
        }
    }

    console.log('\n✅ HARVEST COMPLETE');
}

async function processItem(anime: any, year: number) {
    const title = anime.title?.english || anime.title?.romaji || anime.title?.native;
    // Strip HTML tags just in case, though query asks for asHtml: false
    const originalDesc = anime.description?.replace(/<[^>]*>/g, '') || '';
    const anilistId = anime.id;
    const categoryType = 'ANIME';

    try {
        // 1. Image Pipeline
        let imageUrl: string | null = null;
        if (anime.coverImage?.extraLarge) {
            // Use 'covers' bucket logic via ImageService
            imageUrl = await imageService.processAndUpload(anime.coverImage.extraLarge, 'anime');
        }

        // 2. AI Description
        // Use basic info if description is empty
        const descInput = originalDesc || `${title} (${year}, ${anime.genres?.join(', ')})`;
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, title, descInput, categoryType)
        );

        // 3. Metadata & Tags
        // Generate tags
        const tagNames = await aiLimiter(() =>
            generateTags(supabase, title, description, categoryType)
        );
        const validTags = await ensureTags(supabase, tagNames);

        // Generate embedding
        const embedding = await generateEmbedding(`${title}: ${description}`);

        const item: HarvestItem = {
            title,
            description,
            image_url: imageUrl,
            category_type: categoryType,
            external_ids: { anilist: anilistId },
            metadata: {
                year: anime.startDate?.year || year,
                score: anime.averageScore,
                popularity: anime.popularity,
                genres: anime.genres,
                episodes: anime.episodes,
                studio: anime.studios?.nodes?.[0]?.name,
                status: anime.status,
                source: 'anilist_massive',
                original_description: originalDesc
            },
            cached_tags: validTags,
            ...(embedding ? { embedding } : {})
        };

        // 4. Save
        await upsertItem(supabase, item, 'anilist', anilistId);

    } catch (error) {
        console.error(`     ❌ Failed ${title} (${anilistId}):`, error);
    }
}

startHarvest().catch(console.error);
