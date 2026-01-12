import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';

// Config
const START_YEAR = 2026;
const END_YEAR = 1970;
const MAX_PAGES = 50;  // Per year - AniList limits to ~2500 per query set
const CONCURRENCY = 2;
const ANILIST_API_URL = 'https://graphql.anilist.co';
const PAGE_DELAY_MS = 1500; // 90 req/min = 1.5s is safe

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// Types
interface TriageItem {
    id: string;
    isComplete: boolean;
}

const triageMap = new Map<number, TriageItem>();
const titleMap = new Map<string, TriageItem>();

// GraphQL Query for Manga
const MANGA_QUERY = `
query ($page: Int, $year: Int) {
    Page (page: $page, perPage: 50) {
        pageInfo {
            hasNextPage
        }
        media (
            startDate_greater: $year, 
            startDate_lesser: $year,
            type: MANGA, 
            format_in: [MANGA, NOVEL, ONE_SHOT],
            sort: POPULARITY_DESC, 
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
                large
            }
            startDate { year month day }
            endDate { year }
            averageScore
            popularity
            genres
            volumes
            chapters
            format
            status
            countryOfOrigin
            
            staff(perPage: 5) {
                edges {
                    role
                    node {
                        name { full }
                    }
                }
            }
        }
    }
}
`;

// Fallback query without year filter (for full popularity sort)
const MANGA_QUERY_NO_YEAR = `
query ($page: Int) {
    Page (page: $page, perPage: 50) {
        pageInfo {
            hasNextPage
        }
        media (
            type: MANGA, 
            format_in: [MANGA, NOVEL, ONE_SHOT],
            sort: POPULARITY_DESC, 
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
                large
            }
            startDate { year month day }
            endDate { year }
            averageScore
            popularity
            genres
            volumes
            chapters
            format
            status
            countryOfOrigin
            
            staff(perPage: 5) {
                edges {
                    role
                    node {
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

async function fetchAniList(page: number, year?: number) {
    const query = year ? MANGA_QUERY : MANGA_QUERY_NO_YEAR;
    const variables = year ? { page, year } : { page };

    const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
        if (response.status === 429) {
            console.warn('   ⚠️ Rate limited (AniList). Sleeping 60s...');
            await sleep(60000);
            return fetchAniList(page, year);
        }
        throw new Error(`AniList Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

function extractMetadata(manga: any) {
    const displayTitle = manga.title?.english || manga.title?.romaji || manga.title?.native;

    // Staff extraction
    const staffList: { name: string; role: string }[] = [];
    let author: string | null = null;
    let artist: string | null = null;

    if (manga.staff?.edges) {
        for (const edge of manga.staff.edges) {
            const role = edge.role?.toLowerCase() || '';
            const name = edge.node?.name?.full;
            if (!name) continue;

            staffList.push({ name, role: edge.role });

            if (!author && (role.includes('story') || role.includes('original'))) author = name;
            if (!artist && role.includes('art')) artist = name;
        }
    }

    // Vote average (divide by 10 like anime)
    const voteAvg = manga.averageScore ? (manga.averageScore / 10).toFixed(1) : null;

    // Localization
    const countryToLang: Record<string, string> = { 'JP': 'ja', 'CN': 'zh', 'KR': 'ko', 'TW': 'zh' };
    const originCountry = manga.countryOfOrigin ? [manga.countryOfOrigin] : [];
    const originalLanguage = manga.countryOfOrigin ? (countryToLang[manga.countryOfOrigin] || 'en') : 'ja';

    // Determine category type
    let categoryType = 'MANGA';
    if (manga.format === 'NOVEL') categoryType = 'LIGHT_NOVEL';

    return {
        title: displayTitle,
        romaji_title: manga.title?.romaji,
        original_title: manga.title?.native,
        description_raw: manga.description?.replace(/<[^>]*>/g, '') || '',

        cover_image: manga.coverImage?.extraLarge || manga.coverImage?.large,

        release_year: manga.startDate?.year,
        end_year: manga.endDate?.year,
        status: manga.status,
        format: manga.format,
        volumes: manga.volumes,
        chapters: manga.chapters,
        genres: manga.genres || [],

        staff: staffList,
        author,
        artist,
        original_creator: author || artist,

        popularity: manga.popularity,
        vote_average: voteAvg ? parseFloat(voteAvg) : null,

        origin_countries: originCountry,
        original_language: originalLanguage,
        category_type: categoryType,

        startDate: manga.startDate
    };
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function startHarvest() {
    console.log(`🚀 STARTING SMART MANGA HARVEST (ANILIST)`);
    console.log(`   📅 Years: ${START_YEAR} -> ${END_YEAR}`);
    console.log(`   ⚡ Concurrency: ${CONCURRENCY}`);

    // 1. Build Triage Map
    console.log(`\n📥 Building Triage Map from DB...`);

    const existingItems: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('global_items')
            .select('id, title, romaji_title, external_ids, volumes, release_year, category_type')
            .in('category_type', ['MANGA', 'LIGHT_NOVEL'])
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
            console.error('❌ Failed to load existing items:', error);
            process.exit(1);
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
        const isComplete = !!row.volumes && !!row.release_year;
        const triageItem = { id: row.id, isComplete };

        if (row.external_ids?.anilist) {
            triageMap.set(Number(row.external_ids.anilist), triageItem);
        }
        if (row.title) {
            titleMap.set(`${row.title.toLowerCase()}|MANGA`, triageItem);
        }
        if (row.romaji_title && row.romaji_title !== row.title) {
            titleMap.set(`${row.romaji_title.toLowerCase()}|MANGA`, triageItem);
        }
    });

    console.log(`   ✅ Loaded ${existingItems.length} items.`);

    // 2. First Pass: By Popularity (gets the most popular across all years)
    console.log(`\n📚 PHASE 1: Harvesting by Popularity (All Time)`);

    for (let page = 1; page <= MAX_PAGES; page++) {
        try {
            const data = await fetchAniList(page);
            const results = data.data?.Page?.media || [];
            const hasNext = data.data?.Page?.pageInfo?.hasNextPage;

            if (results.length === 0) break;

            const batch = results.map((manga: any) => {
                const title = manga.title?.english || manga.title?.romaji || manga.title?.native;
                const titleKey = `${title?.toLowerCase() || ''}|MANGA`;

                let status = triageMap.get(manga.id);
                if (!status && title) {
                    status = titleMap.get(titleKey);
                }

                if (!status) return { type: 'NEW', manga };
                if (!status.isComplete) return { type: 'HEAL', manga, id: status.id };
                return { type: 'SKIP', manga };
            });

            const newCount = batch.filter((b: any) => b.type === 'NEW').length;
            const healCount = batch.filter((b: any) => b.type === 'HEAL').length;

            if (newCount === 0 && healCount === 0) {
                process.stdout.write('.');
                if (!hasNext) break;
                await sleep(PAGE_DELAY_MS);
                continue;
            }

            console.log(`   📄 Page ${page}: ${newCount} New, ${healCount} Heal`);

            const tasks = batch.map((task: any) => limit(async () => {
                if (task.type === 'SKIP') return;
                await processTask(task);
            }));

            await Promise.all(tasks);
            await sleep(PAGE_DELAY_MS);

            if (!hasNext) break;

        } catch (err) {
            console.error(`   ❌ Failed Page ${page}:`, err);
            await sleep(5000);
        }
    }

    // 3. Second Pass: By Year (catches year-specific releases)
    console.log(`\n📚 PHASE 2: Harvesting by Year`);

    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        for (let page = 1; page <= 10; page++) { // 10 pages per year = 500 titles
            try {
                const data = await fetchAniList(page, year);
                const results = data.data?.Page?.media || [];

                if (results.length === 0) break;

                const batch = results.map((manga: any) => {
                    const title = manga.title?.english || manga.title?.romaji || manga.title?.native;
                    const titleKey = `${title?.toLowerCase() || ''}|MANGA`;

                    let status = triageMap.get(manga.id);
                    if (!status && title) {
                        status = titleMap.get(titleKey);
                    }

                    if (!status) return { type: 'NEW', manga };
                    if (!status.isComplete) return { type: 'HEAL', manga, id: status.id };
                    return { type: 'SKIP', manga };
                });

                const newCount = batch.filter((b: any) => b.type === 'NEW').length;

                if (newCount === 0) {
                    process.stdout.write('.');
                    continue;
                }

                console.log(`   📄 Year ${year} Page ${page}: ${newCount} New`);

                const tasks = batch.map((task: any) => limit(async () => {
                    if (task.type === 'SKIP') return;
                    await processTask(task);
                }));

                await Promise.all(tasks);
                await sleep(PAGE_DELAY_MS);

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Page ${page}:`, err);
                await sleep(5000);
            }
        }
    }

    console.log('\n✅ SMART MANGA HARVEST COMPLETE');
}

async function processTask(task: any) {
    const manga = task.manga;
    const anilistId = manga.id;
    const meta = extractMetadata(manga);

    try {
        // Common Payload
        const basePayload = {
            external_ids: { anilist: anilistId },

            release_year: meta.release_year,
            original_language: meta.original_language,
            origin_countries: meta.origin_countries,
            status: meta.status,

            romaji_title: meta.romaji_title,
            original_title: meta.original_title,
            original_creator: meta.original_creator,

            genres: meta.genres,
            format: meta.format,
            volumes: meta.volumes,
            chapters: meta.chapters,
            staff: meta.staff,

            vote_average: meta.vote_average,

            last_metadata_update: new Date().toISOString()
        };

        if (task.type === 'NEW') {
            // Double-check existence
            const { data: existing } = await supabase
                .from('global_items')
                .select('id')
                .or(`external_ids->>anilist.eq.${anilistId}`)
                .maybeSingle();

            if (existing) {
                task.type = 'HEAL';
                task.id = (existing as any).id;
            } else {
                // Image
                let imageUrl: string | null = null;
                if (meta.cover_image) {
                    imageUrl = await imageService.processAndUpload(meta.cover_image, 'book');
                }

                // AI Processing
                // RICH CONTEXT
                const richContext = `
Title: ${meta.title} (${meta.release_year || 'N/A'})
Romaji: ${meta.romaji_title || 'N/A'}
Author: ${meta.author || 'Unknown'}
Format: ${meta.format}
Genres: ${meta.genres.join(', ')}
Original: ${meta.description_raw || 'N/A'}
                `.trim();

                const description = await aiLimiter(() =>
                    rewriteDescription(supabase, meta.title, richContext, meta.category_type)
                );

                const tagInput = [...meta.genres, meta.author || '', meta.format].filter(Boolean).join(', ');
                const tagNames = await aiLimiter(() =>
                    generateTags(supabase, meta.title, `${description} Keywords: ${tagInput}`, meta.category_type)
                );
                const validTags = await ensureTags(supabase, tagNames);

                const vectorText = `
                    Title: ${meta.title}
                    Alt: ${meta.romaji_title}
                    Author: ${meta.author || 'Unknown'}
                    Plot: ${description}
                `.trim();
                const embedding = await generateEmbedding(vectorText);

                const newPayload = {
                    ...basePayload,
                    title: meta.title,
                    description,
                    image_url: imageUrl,
                    category_type: meta.category_type,
                    source: 'anilist',
                    external_id: String(anilistId),
                    metadata: {
                        source: 'anilist_manga_smart',
                        original_description: meta.description_raw,
                        popularity: meta.popularity,
                        score: manga.averageScore,
                        end_year: meta.end_year
                    },
                    cached_tags: validTags,
                    vector_text: JSON.stringify(embedding)
                };

                const { error } = await supabase.from('global_items').insert(newPayload as any);
                if (error) {
                    if (error.code === '23505') {
                        console.log(`     ⏭️ Already exists: ${meta.title}`);
                    } else {
                        throw error;
                    }
                }
                triageMap.set(anilistId, { id: 'new', isComplete: true });
                return;
            }
        }

        // HEAL Logic
        if (task.type === 'HEAL') {
            const healPayload = {
                ...basePayload,
                source: 'anilist',
                external_id: String(anilistId)
            };
            await (supabase.from('global_items') as any).update(healPayload).eq('id', task.id);
            triageMap.set(anilistId, { id: task.id, isComplete: true });
        }

    } catch (error) {
        console.error(`     ❌ Failed processing ${meta.title} (${anilistId}):`, error);
    }
}

startHarvest().catch(console.error);
