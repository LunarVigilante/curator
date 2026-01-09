/**
 * Board Games Harvester - BoardGameGeek XML API (Massive Import)
 * Fetches board games from BGG rankings using XML API2
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding, generateTags, ensureTags } from './shared';

const API_DELAY_MS = 3000;  // BGG needs longer delays (3 seconds between requests)
const BATCH_SIZE = 20;      // Max IDs per request

// BGG API Key from environment
const BGG_API_KEY = process.env.BGG_API_KEY;

// Proper User-Agent per BGG API requirements
const USER_AGENT = 'CuratorApp/1.0 (contact: admin@curator.app)';

// Top BGG game IDs (from BGG rankings - top 250)
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
    20551, 18602, 14996, 73439, 70323, 63888, 39463, 38453, 37904, 37111,
    172818, 192291, 194655, 197576, 198994, 215312, 216132, 223321, 226255, 228341,
    230085, 230802, 231733, 233867, 234487, 236457, 237179, 240980, 242302, 244522,
    247763, 249259, 250458, 254640, 255984, 256226, 257614, 258036, 258779, 260428,
    261417, 262211, 262712, 263918, 264220, 265188, 266507, 266524, 266830, 267463,
    268864, 269207, 269210, 270844, 271324, 271896, 273477, 274364, 275467, 276182,
    277659, 278648, 279537, 281259, 282954, 283355, 284378, 285967, 286096, 291453,
    292854, 293014, 295947, 297030, 299141, 301380, 302260, 302723, 303953, 304783,
    305096, 306735, 308765, 310873, 311193, 312674, 315767, 316377, 317371, 318983,
    319545, 320523, 321608, 322289, 324856, 325494, 327831, 328479, 329082, 329716,
    330169, 331571, 332398, 334065, 337627, 338628, 339789, 340466, 341048, 341254,
    342207, 343015, 344573, 345121, 346703, 347516, 349067, 350184, 351042, 352515,
    353545, 354568, 356123, 357563, 358234, 359871, 361545, 362452, 363369, 364073,
    365717, 367220, 368019, 369823, 370591, 371942, 372593, 373106, 374173, 374847,
    375682, 376566, 377018, 378054, 379141, 379990, 380511, 381023, 381549, 382518,
    383179, 384247, 385108, 386214, 387076, 388453, 389104, 390109, 391163, 392014,
];

interface BGGGame {
    id: number;
    name: string;
    description: string;
    image: string;
    yearPublished: string;
    rating: number;
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
    mechanics?: string[];
    categories?: string[];
    designers?: string[];
}

function decodeHTMLEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#10;/g, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '');  // Strip remaining HTML tags
}

/**
 * Fetch data from BGG XML API2
 * Uses boardgamegeek.com (no www) with Bearer token authorization
 * See: https://boardgamegeek.com/wiki/page/BGG_XML_API2
 */
async function fetchFromBgg(path: string): Promise<string> {
    // IMPORTANT: Use boardgamegeek.com without 'www' to avoid redirect stripping auth
    const url = `https://boardgamegeek.com/xmlapi2/${path}`;

    const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
    };

    // Add Bearer token if BGG_API_KEY is configured
    if (BGG_API_KEY) {
        headers['Authorization'] = `Bearer ${BGG_API_KEY}`;
    }

    const response = await fetch(url, {
        method: 'GET',
        headers
    });

    if (!response.ok) {
        if (response.status === 401) {
            console.error('   ⚠️ BGG 401: Check BGG_API_KEY in .env');
        } else if (response.status === 429) {
            console.warn('   ⏳ Rate limited, waiting 30s...');
            await sleep(30000);
            return fetchFromBgg(path);  // Retry
        } else if (response.status === 202) {
            // BGG queuing request - retry after delay
            console.warn('   ⏳ BGG queuing request, waiting 5s...');
            await sleep(5000);
            return fetchFromBgg(path);
        }
        throw new Error(`BGG Error: ${response.status}`);
    }

    return await response.text();
}

async function fetchBGGBatch(ids: number[]): Promise<BGGGame[]> {
    const games: BGGGame[] = [];
    const idsParam = ids.join(',');

    try {
        const xml = await fetchFromBgg(`thing?id=${idsParam}&stats=1`);

        // Parse XML (basic regex parsing)
        const items = xml.match(/<item[^>]*>[\s\S]*?<\/item>/g) || [];

        for (const itemXml of items) {
            const id = itemXml.match(/id="(\d+)"/)?.[1];
            const name = itemXml.match(/<name.*?type="primary".*?value="([^"]+)"/)?.[1];
            const description = itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
            const image = itemXml.match(/<image>(.*?)<\/image>/)?.[1] || '';
            const yearPublished = itemXml.match(/<yearpublished.*?value="(\d+)"/)?.[1] || '';
            const rating = parseFloat(itemXml.match(/<average.*?value="([\d.]+)"/)?.[1] || '0');
            const minPlayers = parseInt(itemXml.match(/<minplayers.*?value="(\d+)"/)?.[1] || '0');
            const maxPlayers = parseInt(itemXml.match(/<maxplayers.*?value="(\d+)"/)?.[1] || '0');
            const playingTime = parseInt(itemXml.match(/<playingtime.*?value="(\d+)"/)?.[1] || '0');

            // Extract mechanics
            const mechanicMatches = itemXml.matchAll(/<link type="boardgamemechanic".*?value="([^"]+)"/g);
            const mechanics = Array.from(mechanicMatches).map(m => m[1]);

            // Extract categories
            const categoryMatches = itemXml.matchAll(/<link type="boardgamecategory".*?value="([^"]+)"/g);
            const categories = Array.from(categoryMatches).map(m => m[1]);

            // Extract designers
            const designerMatches = itemXml.matchAll(/<link type="boardgamedesigner".*?value="([^"]+)"/g);
            const designers = Array.from(designerMatches).map(m => m[1]);

            if (id && name) {
                games.push({
                    id: parseInt(id),
                    name: decodeHTMLEntities(name),
                    description: decodeHTMLEntities(description).slice(0, 2000),
                    image,
                    yearPublished,
                    rating,
                    minPlayers: minPlayers || undefined,
                    maxPlayers: maxPlayers || undefined,
                    playingTime: playingTime || undefined,
                    mechanics: mechanics.slice(0, 10),
                    categories: categories.slice(0, 5),
                    designers: designers.slice(0, 3),
                });
            }
        }
    } catch (error) {
        console.error(`   ❌ BGG fetch error:`, error);
    }

    return games;
}

export async function harvestBoardGames(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎲 HARVESTING BOARD GAMES (BGG - Deep Import)...');
    console.log(`   📋 Config: ${TOP_BGG_IDS.length} games in ${Math.ceil(TOP_BGG_IDS.length / BATCH_SIZE)} batches`);
    console.log(`   ⚠️  Note: BGG has strict rate limits. Using ${API_DELAY_MS}ms between batches.`);

    const games: BGGGame[] = [];
    const gameIds = new Set<number>();

    // Fetch in batches
    const totalBatches = Math.ceil(TOP_BGG_IDS.length / BATCH_SIZE);

    for (let i = 0; i < TOP_BGG_IDS.length; i += BATCH_SIZE) {
        const batch = TOP_BGG_IDS.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        try {
            const batchGames = await fetchBGGBatch(batch);

            for (const game of batchGames) {
                if (!gameIds.has(game.id)) {
                    gameIds.add(game.id);
                    games.push(game);
                }
            }

            console.log(`   🎲 BGG: Batch ${batchNum}/${totalBatches} processed (${games.length} total)`);
        } catch (error) {
            console.error(`   ❌ Batch ${batchNum} failed:`, error);
            // Continue with next batch
        }

        await sleep(API_DELAY_MS);
    }

    console.log(`\n📊 Fetched ${games.length} board games`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < games.length; i++) {
        const game = games[i];

        try {
            // AI rewrite with limiter
            const description = await aiLimiter(() =>
                rewriteDescription(supabase, game.name, game.description, 'Board Game')
            );

            // Generate tags (combine mechanics and categories as hints)
            const tagHints = [...(game.mechanics || []), ...(game.categories || [])].join(', ');
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, game.name, `${description} Features: ${tagHints}`, 'Board Game')
            );
            const validTags = await ensureTags(supabase, tagNames);

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
                    min_players: game.minPlayers,
                    max_players: game.maxPlayers,
                    playing_time: game.playingTime,
                    mechanics: game.mechanics,
                    categories: game.categories,
                    designers: game.designers,
                    source: 'bgg_harvest',
                    original_description: game.description
                },
                cached_tags: validTags,
                ...(embedding ? { embedding } : {})
            };

            const result = await upsertItem(supabase, item, 'bgg', game.id);
            if (result) success++;
            else failed++;
        } catch (error) {
            console.error(`   ❌ Failed to process "${game.name}":`, error);
            failed++;
        }

        if ((i + 1) % 50 === 0) {
            console.log(`   🎲 Board Games: ${i + 1}/${games.length} (${success} added, ${failed} failed)`);
        }

        await sleep(50);
    }

    console.log(`✅ Board Games: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Board Games' };
}
