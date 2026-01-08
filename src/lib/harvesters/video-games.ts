/**
 * Video Games Harvester - RAWG API
 * Fetches top-rated video games from RAWG
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding } from './shared';

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const API_DELAY_MS = 300;
const LIMIT = 100;

interface RAWGGame {
    id: number;
    name: string;
    description_raw?: string;
    background_image: string | null;
    released: string;
    rating: number;
    ratings_count: number;
    metacritic: number | null;
    genres: { name: string }[];
    platforms: { platform: { name: string } }[];
    developers?: { name: string }[];
}

export async function harvestVideoGames(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎮 HARVESTING VIDEO GAMES (RAWG)...');

    if (!RAWG_API_KEY) {
        console.error('❌ RAWG_API_KEY not set');
        return { success: 0, skipped: 0, failed: 0, category: 'Video Games' };
    }

    const games: RAWGGame[] = [];
    const pageSize = 40;
    const pagesToFetch = Math.ceil(LIMIT / pageSize);

    // Fetch list
    for (let page = 1; page <= pagesToFetch; page++) {
        const url = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&ordering=-rating&page_size=${pageSize}&page=${page}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`RAWG error: ${response.status}`);
            const data = await response.json();
            games.push(...data.results);
            await sleep(API_DELAY_MS);
        } catch (error) {
            console.error(`❌ RAWG fetch error (page ${page}):`, error);
        }
    }

    const limitedGames = games.slice(0, LIMIT);
    console.log(`📊 Fetched ${limitedGames.length} video games`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < limitedGames.length; i++) {
        const game = limitedGames[i];

        // Fetch game details for description (list endpoint doesn't include it)
        let description = '';
        try {
            const detailUrl = `https://api.rawg.io/api/games/${game.id}?key=${RAWG_API_KEY}`;
            const detailRes = await fetch(detailUrl);
            if (detailRes.ok) {
                const detail = await detailRes.json();
                description = detail.description_raw || '';
            }
            await sleep(API_DELAY_MS);
        } catch {
            // Use empty description
        }

        // AI rewrite with limiter
        const finalDescription = await aiLimiter(() =>
            rewriteDescription(supabase, game.name, description, 'Video Game')
        );

        // Generate embedding
        const embedding = await generateEmbedding(`${game.name}: ${finalDescription}`);

        const item: HarvestItem = {
            title: game.name,
            description: finalDescription,
            image_url: game.background_image,
            category_type: 'VIDEO_GAME',
            external_ids: { rawg: game.id },
            metadata: {
                released: game.released,
                rating: game.rating,
                ratings_count: game.ratings_count,
                metacritic: game.metacritic,
                genres: game.genres?.map(g => g.name) || [],
                platforms: game.platforms?.map(p => p.platform.name) || [],
                source: 'rawg_harvest',
                original_description: description
            },
            ...(embedding ? { embedding } : {})
        };

        const result = await upsertItem(supabase, item, 'rawg', game.id);
        if (result) success++;
        else failed++;

        if ((i + 1) % 25 === 0) {
            console.log(`   🎮 Video Games: ${i + 1}/${limitedGames.length} (${success} added)`);
        }
    }

    console.log(`✅ Video Games: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Video Games' };
}
