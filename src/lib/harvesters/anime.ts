/**
 * Anime Harvester - AniList GraphQL (Massive Import)
 * Fetches anime using paginated GraphQL queries
 * Targets ~2,500 anime (50 pages × 50 per page)
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '../services/image/imageService';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding, generateTags, ensureTags } from './shared';

const ANILIST_URL = 'https://graphql.anilist.co';
const API_DELAY_MS = 1000;  // AniList rate limit: 90 req/min, so ~1s is safe
const MAX_PAGES = 50;
const PER_PAGE = 50;

interface AniListMedia {
    id: number;
    title: { english: string | null; romaji: string };
    description: string | null;
    coverImage: { extraLarge: string | null; large: string | null };
    startDate: { year: number | null };
    averageScore: number | null;
    popularity: number;
    genres: string[];
    episodes: number | null;
    studios: { nodes: { name: string }[] };
    status: string | null;
    season: string | null;
    seasonYear: number | null;
    countryOfOrigin: string | null;
}

const ANIME_QUERY = `
query ($page: Int, $perPage: Int) {
    Page (page: $page, perPage: $perPage) {
        pageInfo {
            hasNextPage
            lastPage
        }
        media (type: ANIME, format_in: [TV, MOVIE], sort: POPULARITY_DESC, isAdult: false) {
            id
            title {
                romaji
                english
                native
            }
            description
            coverImage {
                extraLarge
                large
            }
            startDate {
                year
            }
            season
            seasonYear
            averageScore
            popularity
            genres
            episodes
            status
            countryOfOrigin
            studios(isMain: true) {
                nodes {
                    name
                }
            }
        }
    }
}
`;

const imageService = new ImageService();

export async function harvestAnime(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎌 HARVESTING ANIME (AniList - Deep Import)...');
    console.log(`   📋 Config: ${MAX_PAGES} pages × ${PER_PAGE} per page = ~${MAX_PAGES * PER_PAGE} anime target`);

    const animeList: AniListMedia[] = [];
    const animeIds = new Set<number>();

    for (let page = 1; page <= MAX_PAGES; page++) {
        try {
            const response = await fetch(ANILIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: ANIME_QUERY,
                    variables: { page, perPage: PER_PAGE }
                })
            });

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('   ⏳ Rate limited, waiting 60s...');
                    await sleep(60000);
                    page--;  // Retry this page
                    continue;
                }
                throw new Error(`AniList error: ${response.status}`);
            }

            const data = await response.json();
            const media = data.data?.Page?.media || [];
            const pageInfo = data.data?.Page?.pageInfo;

            for (const anime of media) {
                if (!animeIds.has(anime.id)) {
                    animeIds.add(anime.id);
                    animeList.push(anime);
                }
            }

            if ((page % 10 === 0) || page === MAX_PAGES) {
                console.log(`   🎌 Anime: Page ${page}/${MAX_PAGES} processed (${animeList.length} total)`);
            }

            // Stop if no more pages
            if (!pageInfo?.hasNextPage) {
                console.log(`   📄 Reached end of results at page ${page}`);
                break;
            }

            await sleep(API_DELAY_MS);
        } catch (error) {
            console.error(`   ❌ AniList fetch error (page ${page}):`, error);
            // Continue to next page
        }
    }

    console.log(`\n📊 Fetched ${animeList.length} unique anime`);

    let success = 0, failed = 0;
    const skipped = 0;

    for (let i = 0; i < animeList.length; i++) {
        const anime = animeList[i];
        const title = anime.title.english || anime.title.romaji;
        const originalDesc = anime.description?.replace(/<[^>]*>/g, '') || '';

        try {
            // AI rewrite with limiter
            const description = await aiLimiter(() =>
                rewriteDescription(supabase, title, originalDesc, 'Anime')
            );

            // Generate tags
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, title, description, 'Anime')
            );
            const validTags = await ensureTags(supabase, tagNames);

            // Generate embedding
            const embedding = await generateEmbedding(`${title}: ${description}`);

            // Process Image (CDN -> Self-Hosted)
            let image_url = anime.coverImage?.extraLarge || anime.coverImage?.large || null;
            if (image_url) {
                const uploadedUrl = await imageService.processAndUpload(image_url, 'anime');
                if (uploadedUrl) {
                    image_url = uploadedUrl;
                }
            }

            // Map countryOfOrigin to language code
            const countryToLang: Record<string, string> = { 'JP': 'ja', 'CN': 'zh', 'KR': 'ko', 'TW': 'zh' };
            const originalLanguage = anime.countryOfOrigin ? (countryToLang[anime.countryOfOrigin] || 'en') : 'ja';

            const item: HarvestItem = {
                title,
                description,
                image_url,
                category_type: 'ANIME',
                external_ids: { anilist: anime.id },
                original_language: originalLanguage,
                origin_countries: anime.countryOfOrigin ? [anime.countryOfOrigin] : [],
                metadata: {
                    year: anime.startDate?.year,
                    score: anime.averageScore,
                    popularity: anime.popularity,
                    genres: anime.genres,
                    episodes: anime.episodes,
                    studio: anime.studios?.nodes?.[0]?.name,
                    status: anime.status,
                    season: anime.season,
                    season_year: anime.seasonYear,
                    country_of_origin: anime.countryOfOrigin,
                    source: 'anilist_harvest',
                    original_description: originalDesc
                },
                cached_tags: validTags,
                ...(embedding ? { embedding } : {})
            };

            const result = await upsertItem(supabase, item, 'anilist', anime.id);
            if (result) success++;
            else failed++;
        } catch (error) {
            console.error(`   ❌ Failed to process "${title}":`, error);
            failed++;
        }

        if ((i + 1) % 100 === 0) {
            console.log(`   🎌 Anime: ${i + 1}/${animeList.length} (${success} added, ${failed} failed)`);
        }

        await sleep(50);
    }

    console.log(`✅ Anime: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Anime' };
}
