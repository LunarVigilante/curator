/**
 * Anime Harvester - AniList GraphQL API
 * Fetches popular anime using AniList's GraphQL endpoint
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding } from './shared';

const ANILIST_URL = 'https://graphql.anilist.co';
const LIMIT = 100;
const API_DELAY_MS = 500;

interface AniListMedia {
    id: number;
    title: { english: string | null; romaji: string };
    description: string | null;
    coverImage: { large: string | null };
    startDate: { year: number | null };
    averageScore: number | null;
    popularity: number;
    genres: string[];
    episodes: number | null;
    studios: { nodes: { name: string }[] };
}

const QUERY = `
query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
            id
            title { english romaji }
            description(asHtml: false)
            coverImage { large }
            startDate { year }
            averageScore
            popularity
            genres
            episodes
            studios(isMain: true) { nodes { name } }
        }
    }
}`;

export async function harvestAnime(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎌 HARVESTING ANIME (AniList)...');

    const animeList: AniListMedia[] = [];
    const perPage = 50;
    const pagesToFetch = Math.ceil(LIMIT / perPage);

    for (let page = 1; page <= pagesToFetch; page++) {
        try {
            const response = await fetch(ANILIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: QUERY,
                    variables: { page, perPage }
                })
            });

            if (!response.ok) throw new Error(`AniList error: ${response.status}`);
            const data = await response.json();
            animeList.push(...(data.data?.Page?.media || []));
            await sleep(API_DELAY_MS);
        } catch (error) {
            console.error(`❌ AniList fetch error (page ${page}):`, error);
        }
    }

    const limitedAnime = animeList.slice(0, LIMIT);
    console.log(`📊 Fetched ${limitedAnime.length} anime`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < limitedAnime.length; i++) {
        const anime = limitedAnime[i];
        const title = anime.title.english || anime.title.romaji;
        const originalDesc = anime.description?.replace(/<[^>]*>/g, '') || '';

        // AI rewrite with limiter
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, title, originalDesc, 'Anime')
        );

        // Generate embedding
        const embedding = await generateEmbedding(`${title}: ${description}`);

        const item: HarvestItem = {
            title,
            description,
            image_url: anime.coverImage?.large || null,
            category_type: 'ANIME',
            external_ids: { anilist: anime.id },
            metadata: {
                year: anime.startDate?.year,
                score: anime.averageScore,
                popularity: anime.popularity,
                genres: anime.genres,
                episodes: anime.episodes,
                studio: anime.studios?.nodes?.[0]?.name,
                source: 'anilist_harvest',
                original_description: originalDesc
            },
            ...(embedding ? { embedding } : {})
        };

        const result = await upsertItem(supabase, item, 'anilist', anime.id);
        if (result) success++;
        else failed++;

        if ((i + 1) % 25 === 0) {
            console.log(`   🎌 Anime: ${i + 1}/${limitedAnime.length} (${success} added)`);
        }

        await sleep(100);
    }

    console.log(`✅ Anime: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Anime' };
}
