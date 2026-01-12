/**
 * Video Games Harvester - RAWG API (Massive Import)
 * Fetches games from RAWG with pagination
 * Targets ~2,000 games (50 pages × 40 per page)
 * NOTE: RAWG has strict rate limits - 1 second delay between requests
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, upsertItem, generateEmbedding, generateTags, ensureTags } from './shared';
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description';

const RAWG_API_KEY = process.env.RAWG_API_KEY;
const API_DELAY_MS = 1000;  // RAWG is strict - 1 second between pages
const DETAIL_DELAY_MS = 500;  // Delay for detail fetches
const MAX_PAGES = 50;
const PAGE_SIZE = 40;

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

// Cache for game details to avoid refetching
const detailCache = new Map<number, string>();

async function fetchGameDescription(gameId: number): Promise<string> {
    if (detailCache.has(gameId)) {
        return detailCache.get(gameId)!;
    }

    try {
        const detailUrl = `https://api.rawg.io/api/games/${gameId}?key=${RAWG_API_KEY}`;
        const detailRes = await fetch(detailUrl);
        if (detailRes.ok) {
            const detail = await detailRes.json();
            const desc = detail.description_raw || '';
            detailCache.set(gameId, desc);
            return desc;
        }
    } catch {
        // Return empty on error
    }
    return '';
}

export async function harvestVideoGames(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎮 HARVESTING VIDEO GAMES (RAWG - Deep Import)...');
    console.log(`   📋 Config: ${MAX_PAGES} pages × ${PAGE_SIZE} per page = ~${MAX_PAGES * PAGE_SIZE} games target`);
    console.log(`   ⚠️  Note: RAWG has strict rate limits. This will take a while.`);

    if (!RAWG_API_KEY) {
        console.error('❌ RAWG_API_KEY not set');
        return { success: 0, skipped: 0, failed: 0, category: 'Video Games' };
    }

    const games: RAWGGame[] = [];
    const gameIds = new Set<number>();

    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&ordering=-rating&page_size=${PAGE_SIZE}&page=${page}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('   ⏳ Rate limited, waiting 30s...');
                    await sleep(30000);
                    page--;  // Retry this page
                    continue;
                }
                throw new Error(`RAWG error: ${response.status}`);
            }

            const data = await response.json();
            const results = data.results || [];

            for (const game of results) {
                if (!gameIds.has(game.id)) {
                    gameIds.add(game.id);
                    games.push(game);
                }
            }

            if ((page % 10 === 0) || page === MAX_PAGES) {
                console.log(`   🎮 Games: Page ${page}/${MAX_PAGES} processed (${games.length} total)`);
            }

            // Stop if no more results
            if (!data.next) {
                console.log(`   📄 Reached end of results at page ${page}`);
                break;
            }

            await sleep(API_DELAY_MS);
        } catch (error) {
            console.error(`   ❌ RAWG fetch error (page ${page}):`, error);
            // Continue to next page
        }
    }

    console.log(`\n📊 Fetched ${games.length} unique video games`);

    let success = 0, failed = 0;
    const skipped = 0;

    for (let i = 0; i < games.length; i++) {
        const game = games[i];
        const genres = game.genres?.map(g => g.name) || [];
        const platforms = game.platforms?.map(p => p.platform.name) || [];
        const developers = game.developers?.map(d => d.name) || [];

        try {
            // Fetch game description (with caching and delay)
            const originalDescription = await fetchGameDescription(game.id);
            await sleep(DETAIL_DELAY_MS);

            // Generate 4-part structured description (parallel LLM calls)
            const description_parts = await aiLimiter(() =>
                generateStructuredDescription(supabase, {
                    title: game.name,
                    originalDescription,
                    type: 'Video Game',
                    metadata: { genres, platforms, developers }
                })
            );

            // Combine for backwards compatibility
            const description = combineDescription(description_parts);

            // Generate tags
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, game.name, description, 'Video Game')
            );
            const validTags = await ensureTags(supabase, tagNames);

            const item: HarvestItem = {
                title: game.name,
                description,
                description_parts,
                image_url: game.background_image,
                category_type: 'VIDEO_GAME',
                external_ids: { rawg: game.id },
                genres,
                platforms,
                developers,
                metadata: {
                    released: game.released,
                    rating: game.rating,
                    ratings_count: game.ratings_count,
                    metacritic: game.metacritic,
                    genres,
                    platforms,
                    developers,
                    source: 'rawg_harvest',
                    original_description: originalDescription
                },
                cached_tags: validTags
            };

            // Generate rich embedding from all item data
            const embeddingText = buildEmbeddingText(item);
            const embedding = await generateEmbedding(embeddingText);
            if (embedding) {
                item.embedding = embedding;
            }

            const result = await upsertItem(supabase, item, 'rawg', game.id);
            if (result) success++;
            else failed++;
        } catch (error) {
            console.error(`   ❌ Failed to process "${game.name}":`, error);
            failed++;
        }

        if ((i + 1) % 100 === 0) {
            console.log(`   🎮 Video Games: ${i + 1}/${games.length} (${success} added, ${failed} failed)`);
        }
    }

    console.log(`✅ Video Games: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Video Games' };
}

