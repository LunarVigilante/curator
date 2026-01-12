import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';

// Config
const START_YEAR = 2026;
const END_YEAR = 1970; // Extended range per user request
const MAX_PAGES = 20;  // Increased depth
const CONCURRENCY = 2;
const ANILIST_API_URL = 'https://graphql.anilist.co';
const OMDB_BASE_URL = 'https://www.omdbapi.com';
const OMDB_API_KEY = process.env.OMDB_API_KEY;

// AniList Rate Limit: 90 req/min => 1.5 req/sec. 
const PAGE_DELAY_MS = 2000;

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// Types
interface TriageItem {
    id: string; // Supabase UUID
    isComplete: boolean;
}

const triageMap = new Map<number, TriageItem>();
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
            isAdult: false,
            format_not_in: [MUSIC]
        ) {
            id
            idMal
            title {
                romaji
                english
                native
            }
            description(asHtml: false)
            coverImage {
                extraLarge
            }
            bannerImage
            season
            seasonYear
            episodes
            duration
            source
            genres
            averageScore
            popularity
            status
            countryOfOrigin
            startDate { year month day }
            
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
            console.warn('   ⚠️ Rate limited (AniList). Sleeping 60s...');
            await sleep(60000);
            return fetchAniList(year, page);
        }
        throw new Error(`AniList Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

async function fetchOmdbByTitle(title: string, year: number) {
    if (!OMDB_API_KEY || !title) return null;

    const cleanTitle = encodeURIComponent(title.replace(/[^\w\s]/gi, ''));

    // Attempt 1: Strict Year
    let url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${cleanTitle}&y=${year}&tomatoes=true`;

    try {
        let res = await fetch(url);
        let data = await res.json();

        // Attempt 2: Loose Year (OMDb sometimes has years off by 1)
        if (data.Response === 'False') {
            url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${cleanTitle}&tomatoes=true`;
            res = await fetch(url);
            data = await res.json();
        }

        if (data.Response === 'False') return null;

        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
        const rtScore = rtSource ? parseInt(rtSource.Value.replace('%', ''), 10) : null;

        return {
            imdb_id: data.imdbID,
            imdb_rating: data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
            imdb_votes: data.imdbVotes ? parseInt(data.imdbVotes.replace(/,/g, ''), 10) : null,
            rotten_tomatoes_rating: rtScore,
            rated: data.Rated !== 'N/A' ? data.Rated : null,
            awards: data.Awards !== 'N/A' ? data.Awards : null,
            box_office: data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
            writer: data.Writer !== 'N/A' ? data.Writer : null,
        };
    } catch (e) {
        console.warn(`   ⚠️ OMDb Search failed for ${title}`, e);
        return null;
    }
}

function extractMetadata(anime: any) {
    const studios = anime.studios?.nodes?.map((s: any) => s.name) || [];
    const mainStudio = studios[0] || null;

    // Staff
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

    // Cast
    const cast = new Set<string>();
    if (anime.characters?.edges) {
        for (const edge of anime.characters.edges) {
            const va = edge.voiceActors?.[0]?.name?.full;
            if (va) cast.add(va);
        }
    }
    const castArray = Array.from(cast).slice(0, 10);

    // Trailer
    const trailer = anime.trailer?.site === 'youtube' && anime.trailer?.id
        ? `https://www.youtube.com/watch?v=${anime.trailer.id}`
        : null;

    // Ratings
    const voteAvg = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

    // Titles
    const displayTitle = anime.title?.english || anime.title?.romaji || anime.title?.native;

    // Localization
    const countryToLang: Record<string, string> = { 'JP': 'ja', 'CN': 'zh', 'KR': 'ko', 'TW': 'zh' };
    const originCountry = anime.countryOfOrigin ? [anime.countryOfOrigin] : [];
    const originalLanguage = anime.countryOfOrigin ? (countryToLang[anime.countryOfOrigin] || 'en') : 'ja';

    return {
        // IDs
        idMal: anime.idMal,

        // Basic
        title: displayTitle,
        romaji_title: anime.title?.romaji,
        original_title: anime.title?.native, // Use native as original
        description_raw: anime.description?.replace(/<[^>]*>/g, '') || '',

        // Visuals
        cover_image: anime.coverImage?.extraLarge,
        banner_url: anime.bannerImage || null,
        trailer_url: trailer,

        // Metadata
        release_year: anime.startDate?.year || anime.seasonYear,
        season: anime.season, // WINTER, SUMMER etc
        status: anime.status,
        episodes: anime.episodes,
        runtime: anime.duration,
        source_material: anime.source,
        genres: anime.genres || [],

        // People / Companies
        studios: studios,
        studio: mainStudio, // Keep singular for legacy compat
        director,
        writer,
        original_creator: originalCreator,
        cast: castArray,

        // Metrics
        popularity: anime.popularity,
        vote_average: voteAvg ? parseFloat(voteAvg) : null,

        // Localization
        origin_countries: originCountry,
        original_language: originalLanguage,

        // Dates
        startDate: anime.startDate
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
    const triageMap = new Map<number, TriageItem>();
    const titleMap = new Map<string, TriageItem>();

    const existingItems: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('global_items')
            .select('id, title, romaji_title, external_ids, studio, release_year, category_type')
            .eq('category_type', 'ANIME')
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
        // Enforce Studio AND Release Year for completeness
        const isComplete = !!row.studio && !!row.release_year;
        const triageItem = { id: row.id, isComplete };

        if (row.external_ids?.anilist) {
            triageMap.set(Number(row.external_ids.anilist), triageItem);
        }
        if (row.title) {
            titleMap.set(`${row.title.toLowerCase()}|ANIME`, triageItem);
        }
        if (row.romaji_title && row.romaji_title !== row.title) {
            titleMap.set(`${row.romaji_title.toLowerCase()}|ANIME`, triageItem);
        }
    });

    console.log(`   ✅ Loaded ${existingItems.length} items.`);

    // 2. Iterate Years
    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const data = await fetchAniList(year, page);
                const results = data.data?.Page?.media || [];

                if (results.length === 0) break;

                const batch = results.map((anime: any) => {
                    const title = anime.title?.english || anime.title?.romaji || anime.title?.native;
                    const titleKey = `${title?.toLowerCase() || ''}|ANIME`;

                    let status = triageMap.get(anime.id);
                    if (!status && title) {
                        status = titleMap.get(titleKey);
                    }

                    if (!status) return { type: 'NEW', anime };
                    if (!status.isComplete) return { type: 'HEAL', anime, id: status.id };
                    return { type: 'SKIP', anime };
                });

                const newCount = batch.filter((b: any) => b.type === 'NEW').length;
                const healCount = batch.filter((b: any) => b.type === 'HEAL').length;

                if (newCount === 0 && healCount === 0) {
                    process.stdout.write('.');
                    continue;
                }

                console.log(`   📄 Year ${year} Page ${page}: ${newCount} New, ${healCount} Heal`);

                const tasks = batch.map((task: any) => limit(async () => {
                    if (task.type === 'SKIP') return;
                    await processTask(task, year, triageMap); // Pass Map to update it
                }));

                await Promise.all(tasks);
                await sleep(PAGE_DELAY_MS);

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Page ${page}:`, err);
                await sleep(5000);
            }
        }
    }
    console.log('\n✅ SMART HARVEST COMPLETE');
}

async function processTask(task: any, year: number, triageMap: Map<number, TriageItem>) {
    const anime = task.anime;
    const anilistId = anime.id;
    const meta = extractMetadata(anime);
    const categoryType = 'ANIME';

    try {
        // Enriched Data Fetching (OMDb)
        // Try English ID first, then Romaji if distinct
        let omdbData = await fetchOmdbByTitle(meta.title, year);
        if (!omdbData && meta.romaji_title && meta.romaji_title !== meta.title) {
            omdbData = await fetchOmdbByTitle(meta.romaji_title, year);
        }

        const finalWriter = omdbData?.writer || meta.writer || meta.original_creator;
        const finalContentRating = omdbData?.rated || null; // AniList doesn't give clean rating strings often

        // Common Payload (HEAL or NEW)
        const basePayload = {
            external_ids: {
                anilist: anilistId,
                mal: meta.idMal,
                imdb: omdbData?.imdb_id
            },

            // Core
            release_year: meta.release_year,
            original_language: meta.original_language,
            origin_countries: meta.origin_countries,
            status: meta.status,
            season: meta.season,

            // Text / Names
            romaji_title: meta.romaji_title,
            original_title: meta.original_title,

            // Credits
            cast: meta.cast,
            director: meta.director,
            writer: finalWriter,
            original_creator: meta.original_creator,
            studios: meta.studios,
            studio: meta.studio,

            // Specs
            episodes: meta.episodes,
            runtime: meta.runtime,
            source_material: meta.source_material,
            genres: meta.genres,

            // Ratings (Prioritize OMDB for Rotten Tomatoes / IMDB)
            vote_average: meta.vote_average,
            imdb_rating: omdbData?.imdb_rating || null,
            imdb_votes: omdbData?.imdb_votes || null,
            rotten_tomatoes_rating: omdbData?.rotten_tomatoes_rating || null,
            content_rating: finalContentRating,
            awards_text: omdbData?.awards || null,
            box_office: omdbData?.box_office || null,

            trailer_url: meta.trailer_url,
            banner_url: meta.banner_url,
            backdrop_path: meta.banner_url, // Mirror banner to backdrop for standard UI compatibility

            last_metadata_update: new Date().toISOString()
        };

        if (task.type === 'NEW') {

            // 🛑 SAFETY CHECK: Double-check if item exists (avoid race conditions / triage misses)
            // This prevents uploading images for items that fail to insert due to duplicates
            const { data: existing } = await supabase
                .from('global_items')
                .select('id, external_ids')
                .or(`external_id.eq.${anilistId},external_ids->>anilist.eq.${anilistId}`)
                .maybeSingle();

            if (existing) {
                console.log(`     ⚠️ Found existing item during processing (Triage Miss): ${meta.title}`);
                task.type = 'HEAL';
                task.id = (existing as any).id;
                // Fallthrough to HEAL logic below
            } else {
                console.log(`\n   ╔════════════════════════════════════════════════════════════════`);
                console.log(`   ║ 🎬 NEW ANIME: ${meta.title}`);
                console.log(`   ╠════════════════════════════════════════════════════════════════`);
                console.log(`   ║ AniList ID: ${anilistId}`);
                console.log(`   ║ MAL ID: ${meta.idMal || 'N/A'}`);
                console.log(`   ║ Year: ${meta.release_year || 'N/A'}`);
                console.log(`   ╟────────────────────────────────────────────────────────────────`);
                console.log(`   ║ 📊 METADATA COLLECTED:`);
                console.log(`   ║    Studio: ${meta.studio || 'N/A'}`);
                console.log(`   ║    Director: ${meta.director || 'N/A'}`);
                console.log(`   ║    Episodes: ${meta.episodes || 'N/A'}`);
                console.log(`   ║    Runtime: ${meta.runtime || 'N/A'} min`);
                console.log(`   ║    Status: ${meta.status || 'N/A'}`);
                console.log(`   ║    Season: ${meta.season || 'N/A'}`);
                console.log(`   ║    Genres: ${meta.genres.slice(0, 5).join(', ') || 'N/A'}`);
                console.log(`   ║    Cast: ${meta.cast.slice(0, 3).join(', ') || 'N/A'}`);
                console.log(`   ║    Rating: ${meta.vote_average || 'N/A'}`);
                console.log(`   ╟────────────────────────────────────────────────────────────────`);

                // Handle Images (Only for TRULY new items)
                let imageUrl: string | null = null;
                if (meta.cover_image) {
                    console.log(`   ║ 🖼️  UPLOADING IMAGE...`);
                    console.log(`   ║    Source: ${meta.cover_image.slice(0, 60)}...`);
                    const startImg = Date.now();
                    imageUrl = await imageService.processAndUpload(meta.cover_image, 'anime');
                    if (imageUrl) {
                        console.log(`   ║    ✅ Uploaded in ${Date.now() - startImg}ms`);
                        console.log(`   ║    Dest: ${imageUrl.slice(0, 60)}...`);
                    } else {
                        console.log(`   ║    ⚠️  Upload failed`);
                    }
                } else {
                    console.log(`   ║ ⚠️  No cover image available`);
                }

                // AI Processing
                console.log(`   ╟────────────────────────────────────────────────────────────────`);
                console.log(`   ║ 🧠 GENERATING AI DESCRIPTION...`);
                console.log(`   ║    Original: ${(meta.description_raw || '').slice(0, 80)}...`);
                // RICH CONTEXT
                const richContext = `
Title: ${meta.title} (${year})
Studio: ${meta.studio || 'N/A'}
Director: ${meta.director || 'N/A'}
Cast: ${meta.cast.slice(0, 5).join(', ')}
Genres: ${meta.genres.join(', ')}
Original: ${meta.description_raw || 'N/A'}
                `.trim();

                const startDesc = Date.now();
                const description = await aiLimiter(() =>
                    rewriteDescription(supabase, meta.title, richContext, categoryType)
                );
                console.log(`   ║    ✅ Generated in ${Date.now() - startDesc}ms`);
                console.log(`   ║    Result: ${description.slice(0, 80)}...`);

                console.log(`   ╟────────────────────────────────────────────────────────────────`);
                console.log(`   ║ 🏷️  GENERATING TAGS...`);
                const tagInput = [...meta.genres, ...meta.studios].join(', ');
                const startTags = Date.now();
                const tagNames = await aiLimiter(() =>
                    generateTags(supabase, meta.title, `${description} Keywords: ${tagInput}`, categoryType)
                );
                const validTags = await ensureTags(supabase, tagNames);
                console.log(`   ║    ✅ Generated ${tagNames.length} tags in ${Date.now() - startTags}ms`);
                console.log(`   ║    Tags: ${tagNames.slice(0, 8).join(', ')}`);

                console.log(`   ╟────────────────────────────────────────────────────────────────`);
                console.log(`   ║ 🧮 GENERATING EMBEDDING...`);
                const vectorText = `
                    Title: ${meta.title}
                    Alt: ${meta.romaji_title}
                    Studio: ${meta.studios.join(', ')}
                    Plot: ${description}
                `.trim();
                console.log(`   ║    Vector text length: ${vectorText.length} chars`);
                const startEmbed = Date.now();
                const embedding = await generateEmbedding(vectorText);
                if (embedding) {
                    console.log(`   ║    ✅ Embedding generated in ${Date.now() - startEmbed}ms (${embedding.length} dimensions)`);
                } else {
                    console.log(`   ║    ⚠️  No embedding generated`);
                }

                console.log(`   ╟────────────────────────────────────────────────────────────────`);
                console.log(`   ║ 💾 SAVING TO DATABASE...`);
                const newPayload = {
                    ...basePayload,
                    title: meta.title,
                    description: description,
                    image_url: imageUrl,
                    category_type: categoryType,
                    // Enforce Uniqueness Constraint
                    source: 'anilist',
                    external_id: String(anilistId),
                    metadata: {
                        source: `anilist_smart`,
                        original_description: meta.description_raw,
                        popularity: meta.popularity,
                        score: anime.averageScore,
                        release_date: (meta.startDate?.year && meta.startDate?.month && meta.startDate?.day)
                            ? `${meta.startDate.year}-${String(meta.startDate.month).padStart(2, '0')}-${String(meta.startDate.day).padStart(2, '0')}`
                            : null
                    },
                    cached_tags: validTags,
                    vector_text: JSON.stringify(embedding)
                };

                const { error } = await supabase.from('global_items').insert(newPayload as any);
                if (error) {
                    if (error.code === '23505') {
                        console.log(`   ║ ⏭️  Already exists (Constraint)`);
                    } else {
                        console.log(`   ║ ❌ DB ERROR: ${error.message}`);
                    }
                } else {
                    console.log(`   ║ ✅ SAVED SUCCESSFULLY`);
                }
                console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
                triageMap.set(anilistId, { id: 'new-id', isComplete: true });
                return; // Done with NEW
            }
        }

        // HEAL Logic (Also runs if Safety Check found existing)
        if (task.type === 'HEAL') {
            console.log(`\n   ╔════════════════════════════════════════════════════════════════`);
            console.log(`   ║ 🔧 HEAL ANIME: ${meta.title}`);
            console.log(`   ╠════════════════════════════════════════════════════════════════`);
            console.log(`   ║ AniList ID: ${anilistId}`);
            console.log(`   ║ DB ID: ${task.id}`);
            console.log(`   ║ Year: ${meta.release_year || 'N/A'}`);
            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 📊 UPDATING METADATA:`);
            console.log(`   ║    Studio: ${meta.studio || 'N/A'}`);
            console.log(`   ║    Director: ${meta.director || 'N/A'}`);
            console.log(`   ║    Episodes: ${meta.episodes || 'N/A'}`);
            console.log(`   ║    Genres: ${meta.genres.slice(0, 5).join(', ') || 'N/A'}`);
            console.log(`   ╟────────────────────────────────────────────────────────────────`);

            // Regenerate embedding with updated metadata
            console.log(`   ║ 🧮 REGENERATING EMBEDDING...`);
            const vectorText = `
                Title: ${meta.title}
                Alt: ${meta.romaji_title}
                Studio: ${meta.studios.join(', ')}
                Director: ${meta.director || 'Unknown'}
                Genres: ${meta.genres.join(', ')}
                Cast: ${meta.cast.join(', ')}
            `.trim();
            console.log(`   ║    Vector text length: ${vectorText.length} chars`);
            const startEmbed = Date.now();
            const embedding = await generateEmbedding(vectorText);
            if (embedding) {
                console.log(`   ║    ✅ Embedding generated in ${Date.now() - startEmbed}ms (${embedding.length} dimensions)`);
            } else {
                console.log(`   ║    ⚠️  No embedding generated`);
            }

            console.log(`   ╟────────────────────────────────────────────────────────────────`);
            console.log(`   ║ 💾 SAVING TO DATABASE...`);

            // Ensure external_id constraint is filled if missing
            const healPayload = {
                ...basePayload,
                source: 'anilist',
                external_id: String(anilistId),
                vector_text: embedding ? JSON.stringify(embedding) : undefined
            };
            const { error } = await (supabase.from('global_items') as any).update(healPayload).eq('id', task.id);

            if (error) {
                console.log(`   ║ ❌ DB ERROR: ${error.message}`);
            } else {
                console.log(`   ║ ✅ HEALED SUCCESSFULLY`);
            }
            console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
            triageMap.set(anilistId, { id: task.id, isComplete: true });
        }

    } catch (error) {
        console.error(`     ❌ Failed processing ${meta.title} (${anilistId}):`, error);
    }
}

startHarvest().catch(console.error);
