/**
 * Board Games Harvester - BoardGameGeek XML API
 * Fetches hot/top-ranked board games from BGG
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding } from './shared';

const LIMIT = 100;
const API_DELAY_MS = 1000; // BGG needs longer delays
const BATCH_SIZE = 20;

// Top 100 BGG game IDs (from BGG rankings)
const TOP_BGG_IDS = [
    174430, 224517, 167791, 342942, 291457, 316554, 312484, 233078, 169786, 193738,
    187645, 220308, 266192, 295770, 162886, 237182, 229853, 284083, 285774, 256960,
    244521, 239188, 276025, 251247, 199792, 161936, 246900, 175914, 205637, 164928,
    12333, 68448, 3076, 182028, 102794, 155821, 28720, 36218, 2651, 31260,
    9209, 84876, 148228, 115746, 173346, 126163, 167355, 191189, 203993, 121921,
    62219, 96848, 50, 432, 822, 13, 30549, 39856, 170216, 169255,
    180263, 161533, 147020, 124361, 102680, 103343, 35677, 124742, 37111, 40834,
    41114, 71721, 146508, 144733, 157969, 144344, 156129, 176920, 183394, 185343,
    181304, 155987, 150376, 142135, 129622, 118048, 34635, 29223, 25669, 25613,
    20551, 18602, 14996, 73439, 70323, 63888, 39463, 38453, 37904, 37111
];

interface BGGGame {
    id: number;
    name: string;
    description: string;
    image: string;
    yearPublished: string;
    rating: number;
}

function decodeHTMLEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#10;/g, ' ');
}

async function fetchBGGBatch(ids: number[]): Promise<BGGGame[]> {
    const games: BGGGame[] = [];
    const idsParam = ids.join(',');
    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idsParam}&stats=1`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`BGG error: ${response.status}`);
        const xml = await response.text();

        // Parse XML
        const items = xml.match(/<item[^>]*>[\s\S]*?<\/item>/g) || [];

        for (const itemXml of items) {
            const id = itemXml.match(/id="(\d+)"/)?.[1];
            const name = itemXml.match(/<name.*?type="primary".*?value="([^"]+)"/)?.[1];
            const description = itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
            const image = itemXml.match(/<image>(.*?)<\/image>/)?.[1] || '';
            const yearPublished = itemXml.match(/<yearpublished.*?value="(\d+)"/)?.[1] || '';
            const rating = parseFloat(itemXml.match(/<average.*?value="([\d.]+)"/)?.[1] || '0');

            if (id && name) {
                games.push({
                    id: parseInt(id),
                    name: decodeHTMLEntities(name),
                    description: decodeHTMLEntities(description).slice(0, 1000),
                    image,
                    yearPublished,
                    rating
                });
            }
        }
    } catch (error) {
        console.error(`❌ BGG fetch error:`, error);
    }

    return games;
}

export async function harvestBoardGames(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎲 HARVESTING BOARD GAMES (BGG)...');

    const games: BGGGame[] = [];
    const idsToFetch = TOP_BGG_IDS.slice(0, LIMIT);

    // Fetch in batches
    for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        const batch = idsToFetch.slice(i, i + BATCH_SIZE);
        const batchGames = await fetchBGGBatch(batch);
        games.push(...batchGames);
        console.log(`   🎲 Fetched BGG batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(idsToFetch.length / BATCH_SIZE)}`);
        await sleep(API_DELAY_MS);
    }

    console.log(`📊 Fetched ${games.length} board games`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < games.length; i++) {
        const game = games[i];

        // AI rewrite with limiter
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, game.name, game.description, 'Board Game')
        );

        // Generate embedding
        const embedding = await generateEmbedding(`${game.name}: ${description}`);

        const item: HarvestItem = {
            title: game.name,
            description,
            image_url: game.image || null,
            category_type: 'BOARD_GAME',
            external_ids: { bgg: game.id },
            metadata: {
                year_published: game.yearPublished,
                rating: game.rating,
                source: 'bgg_harvest',
                original_description: game.description
            },
            ...(embedding ? { embedding } : {})
        };

        const result = await upsertItem(supabase, item, 'bgg', game.id);
        if (result) success++;
        else failed++;

        if ((i + 1) % 25 === 0) {
            console.log(`   🎲 Board Games: ${i + 1}/${games.length} (${success} added)`);
        }

        await sleep(100);
    }

    console.log(`✅ Board Games: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Board Games' };
}
