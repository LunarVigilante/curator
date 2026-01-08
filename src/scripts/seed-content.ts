import 'dotenv/config';
import { createServiceRoleClient } from '../lib/supabase/service-role';
import { callLLM } from '../lib/llm';
import { SystemConfigService } from '../lib/services/SystemConfigService';

/**
 * Bulk content seeding script for Curator
 * Seeds movies from TMDB, board games from BGG, and books from Google Books
 * Generates Voyage AI embeddings for each item
 * Uses the same LLM configuration as the app for descriptions
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-3";
const REWRITE_CONCURRENCY = 5; // Max concurrent rewrite requests
const BATCH_SIZE = 50;
const API_DELAY_MS = 300; // Delay between API calls to avoid rate limits
const EMBED_DELAY_MS = 500; // Delay between embedding batches

// ============================================================================
// TYPES
// ============================================================================

interface GlobalItem {
    title: string;
    description: string;
    image_url: string | null;
    category_type: string;
    external_ids: Record<string, any>;
    metadata: Record<string, any>;
    embedding?: number[];
}

interface VoyageEmbeddingResponse {
    data: Array<{ embedding: number[]; index: number }>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simple concurrency limiter
function createLimiter(concurrency: number) {
    let active = 0;
    const queue: (() => void)[] = [];

    return async <T>(fn: () => Promise<T>): Promise<T> => {
        while (active >= concurrency) {
            await new Promise<void>(resolve => queue.push(resolve));
        }
        active++;
        try {
            return await fn();
        } finally {
            active--;
            const next = queue.shift();
            if (next) next();
        }
    };
}

const rewriteLimiter = createLimiter(REWRITE_CONCURRENCY);

// Cache for LLM config (fetched once at startup)
let llmConfig: { provider: string; apiKey: string; model?: string; endpoint?: string } | null = null;

async function getLLMConfig() {
    if (llmConfig) return llmConfig;

    const provider = await SystemConfigService.getDecryptedConfig('llm_provider') || 'openrouter';
    let apiKey = await SystemConfigService.getDecryptedConfig('llm_api_key');
    const model = await SystemConfigService.getDecryptedConfig('llm_model');
    const endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint');

    // Fallback to provider-specific keys
    if (!apiKey) {
        switch (provider) {
            case 'anthropic': apiKey = await SystemConfigService.getDecryptedConfig('anthropic_api_key'); break;
            case 'openai': apiKey = await SystemConfigService.getDecryptedConfig('openai_api_key'); break;
            case 'openrouter': apiKey = await SystemConfigService.getDecryptedConfig('openrouter_api_key'); break;
            case 'google': apiKey = await SystemConfigService.getDecryptedConfig('google_ai_api_key'); break;
        }
    }

    // Ultimate fallback
    if (!apiKey) {
        apiKey = await SystemConfigService.getDecryptedConfig('openrouter_api_key') ||
            await SystemConfigService.getDecryptedConfig('anthropic_api_key') ||
            await SystemConfigService.getDecryptedConfig('openai_api_key') ||
            await SystemConfigService.getDecryptedConfig('google_ai_api_key') || '';
    }

    llmConfig = { provider, apiKey, model: model || undefined, endpoint: endpoint || undefined };
    return llmConfig;
}

/**
 * Generate a description using the same format as the app's generateDescriptionAction
 * Falls back to original if generation fails
 */
async function generateDescription(title: string, type: string, originalOverview: string): Promise<string> {
    try {
        const config = await getLLMConfig();
        if (!config.apiKey) {
            console.warn(`⚠️ No LLM API key configured, using original description`);
            return originalOverview;
        }

        const systemPrompt = `You are an expert curator and critic. Generate a compelling description for the given item.

DESCRIPTION FORMAT:
1. Body: Maximum 50 words. Focus on plot summary first, then the vibe/atmosphere.
2. Footer: After the body, append exactly this format on a new line after a double newline:

Year: YYYY | Creator: [Name] | Notable Awards: [Awards or "None"]

Return ONLY the description text. No JSON, no markdown, no quotes.`;

        const userPrompt = `Generate a description for:
Title: ${title}
Type: ${type}
Additional Context: ${originalOverview}`;

        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            timeoutMs: 60000
        });

        const description = response.trim();
        if (description && description.length > 20) {
            return description;
        }
        return originalOverview;
    } catch (error) {
        console.warn(`⚠️ Description generation failed for "${title}":`, error);
        return originalOverview;
    }
}

async function generateEmbedding(text: string, retries = 1): Promise<number[] | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(VOYAGE_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${VOYAGE_API_KEY}`,
                },
                body: JSON.stringify({
                    model: EMBEDDING_MODEL,
                    input: [text],
                }),
            });

            if (!response.ok) {
                if (attempt < retries) {
                    console.warn(`⚠️ Embedding failed, retrying... (${response.status})`);
                    await sleep(1000);
                    continue;
                }
                console.error(`❌ Embedding failed after retries: ${response.status}`);
                return null;
            }

            const data: VoyageEmbeddingResponse = await response.json();
            return data.data[0].embedding;
        } catch (error) {
            if (attempt < retries) {
                console.warn(`⚠️ Network error, retrying...`);
                await sleep(1000);
                continue;
            }
            console.error("❌ Network error generating embedding:", error);
            return null;
        }
    }
    return null;
}

async function checkItemExists(supabase: any, externalIdKey: string, externalIdValue: string | number): Promise<boolean> {
    const { data } = await supabase
        .from('global_items')
        .select('id')
        .contains('external_ids', { [externalIdKey]: externalIdValue })
        .limit(1);
    return data && data.length > 0;
}

async function insertItem(supabase: any, item: GlobalItem): Promise<boolean> {
    const { error } = await (supabase.from('global_items') as any).insert(item);
    if (error) {
        console.error(`❌ Insert error for "${item.title}":`, error.message);
        return false;
    }
    return true;
}

// ============================================================================
// TMDB: MOVIES
// ============================================================================

interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    release_date: string;
    vote_average: number;
}

async function fetchTMDBMovies(endpoint: string, pages: number): Promise<TMDBMovie[]> {
    const movies: TMDBMovie[] = [];

    for (let page = 1; page <= pages; page++) {
        const url = `https://api.themoviedb.org/3/movie/${endpoint}?api_key=${TMDB_API_KEY}&page=${page}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
            const data = await response.json();
            movies.push(...data.results);
            await sleep(API_DELAY_MS);
        } catch (error) {
            console.error(`❌ TMDB fetch error (page ${page}):`, error);
        }
    }

    return movies;
}

async function seedMovies(supabase: any): Promise<{ success: number; skipped: number; failed: number }> {
    console.log("\n🎬 SEEDING MOVIES FROM TMDB...");

    if (!TMDB_API_KEY) {
        console.error("❌ TMDB_API_KEY not set, skipping movies");
        return { success: 0, skipped: 0, failed: 0 };
    }

    // Fetch top rated + popular (10 pages each = 200 movies)
    const topRated = await fetchTMDBMovies('top_rated', 5);
    const popular = await fetchTMDBMovies('popular', 5);

    // Dedupe by ID
    const movieMap = new Map<number, TMDBMovie>();
    [...topRated, ...popular].forEach(m => movieMap.set(m.id, m));
    const movies = Array.from(movieMap.values());

    console.log(`📊 Found ${movies.length} unique movies`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < movies.length; i++) {
        const movie = movies[i];

        // Check existence
        if (await checkItemExists(supabase, 'tmdb', movie.id)) {
            skipped++;
            continue;
        }

        // Generate description with LLM (with concurrency limit) - same as when user adds items
        const styledDescription = await rewriteLimiter(() =>
            generateDescription(movie.title, 'Movie', movie.overview)
        );

        // Generate embedding using the styled description
        const text = `${movie.title}: ${styledDescription}`;
        const embedding = await generateEmbedding(text);

        if (!embedding) {
            console.error(`❌ Failed to embed: ${movie.title}`);
            failed++;
            continue;
        }

        // Format and insert
        const item: GlobalItem = {
            title: movie.title,
            description: styledDescription,
            image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            category_type: 'movie',
            external_ids: { tmdb: movie.id },
            metadata: {
                release_date: movie.release_date,
                vote_average: movie.vote_average,
                source: 'tmdb_seed',
                original_overview: movie.overview // Keep original for reference
            },
            embedding
        };

        if (await insertItem(supabase, item)) {
            success++;
        } else {
            failed++;
        }

        if ((i + 1) % 25 === 0) {
            console.log(`📽️ Movies: ${i + 1}/${movies.length} processed (${success} added, ${skipped} skipped)`);
        }

        await sleep(EMBED_DELAY_MS);
    }

    console.log(`✅ Movies complete: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed };
}

// ============================================================================
// BOARD GAME GEEK: BOARD GAMES
// ============================================================================

// Top 100 BGG game IDs (hardcoded from BGG hotness/rankings)
const TOP_BGG_GAME_IDS = [
    174430, 224517, 167791, 342942, 291457, 316554, 312484,
    233078, 169786, 193738, 187645, 220308, 266192, 295770,
    162886, 237182, 229853, 284083, 285774, 256960, 244521,
    239188, 276025, 251247, 199792, 161936, 246900, 175914,
    205637, 164928, 12333, 68448, 3076, 182028, 102794,
    155821, 28720, 36218, 2651, 31260, 9209, 84876,
    148228, 115746, 173346, 126163, 167355, 191189, 203993,
    // Additional top games
    121921, 62219, 96848, 50, 432, 822, 13, 30549, 39856,
    170216, 169255, 180263, 161533, 147020, 124361, 102680,
    103343, 35677, 124742, 37111, 40834, 41114, 71721,
    146508, 144733, 157969, 144344, 156129, 176920, 183394,
    185343, 181304, 155987, 150376, 142135, 129622, 118048,
    34635, 29223, 25669, 25613, 20551, 18602, 14996
];

interface BGGGame {
    id: number;
    name: string;
    description: string;
    image: string;
    yearPublished: string;
    rating: number;
}

async function fetchBGGGameDetails(gameIds: number[]): Promise<BGGGame[]> {
    const games: BGGGame[] = [];
    const batchSize = 20; // BGG allows batch requests

    for (let i = 0; i < gameIds.length; i += batchSize) {
        const batch = gameIds.slice(i, i + batchSize);
        const idsParam = batch.join(',');
        const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idsParam}&stats=1`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`BGG error: ${response.status}`);
            const xml = await response.text();

            // Simple XML parsing (extract key fields)
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
                        description: decodeHTMLEntities(description.replace(/&#10;/g, ' ').slice(0, 1000)),
                        image,
                        yearPublished,
                        rating
                    });
                }
            }

            console.log(`🎲 Fetched BGG batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gameIds.length / batchSize)}`);
            await sleep(API_DELAY_MS * 2); // BGG needs more delay
        } catch (error) {
            console.error(`❌ BGG fetch error:`, error);
        }
    }

    return games;
}

function decodeHTMLEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

async function seedBoardGames(supabase: any): Promise<{ success: number; skipped: number; failed: number }> {
    console.log("\n🎲 SEEDING BOARD GAMES FROM BGG...");

    const games = await fetchBGGGameDetails(TOP_BGG_GAME_IDS.slice(0, 100));
    console.log(`📊 Fetched ${games.length} board games`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < games.length; i++) {
        const game = games[i];

        // Check existence
        if (await checkItemExists(supabase, 'bgg', game.id)) {
            skipped++;
            continue;
        }

        // Generate embedding
        const text = `${game.name}: ${game.description}`;
        const embedding = await generateEmbedding(text);

        if (!embedding) {
            console.error(`❌ Failed to embed: ${game.name}`);
            failed++;
            continue;
        }

        // Format and insert
        const item: GlobalItem = {
            title: game.name,
            description: game.description,
            image_url: game.image || null,
            category_type: 'board_game',
            external_ids: { bgg: game.id },
            metadata: {
                year_published: game.yearPublished,
                rating: game.rating,
                source: 'bgg_seed'
            },
            embedding
        };

        if (await insertItem(supabase, item)) {
            success++;
        } else {
            failed++;
        }

        if ((i + 1) % 25 === 0) {
            console.log(`🎲 Board Games: ${i + 1}/${games.length} processed (${success} added, ${skipped} skipped)`);
        }

        await sleep(EMBED_DELAY_MS);
    }

    console.log(`✅ Board Games complete: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed };
}

// ============================================================================
// GOOGLE BOOKS: BOOKS
// ============================================================================

interface GoogleBook {
    id: string;
    title: string;
    authors: string[];
    description: string;
    imageLinks?: { thumbnail?: string };
    publishedDate?: string;
    averageRating?: number;
}

async function fetchGoogleBooks(query: string, maxResults = 40): Promise<GoogleBook[]> {
    const books: GoogleBook[] = [];
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&orderBy=relevance&key=${GOOGLE_BOOKS_API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google Books error: ${response.status}`);
        const data = await response.json();

        for (const item of data.items || []) {
            const vol = item.volumeInfo;
            if (vol.title && vol.description) {
                books.push({
                    id: item.id,
                    title: vol.title,
                    authors: vol.authors || [],
                    description: vol.description?.slice(0, 1000) || '',
                    imageLinks: vol.imageLinks,
                    publishedDate: vol.publishedDate,
                    averageRating: vol.averageRating
                });
            }
        }
    } catch (error) {
        console.error(`❌ Google Books fetch error:`, error);
    }

    return books;
}

async function seedBooks(supabase: any): Promise<{ success: number; skipped: number; failed: number }> {
    console.log("\n📚 SEEDING BOOKS FROM GOOGLE BOOKS...");

    if (!GOOGLE_BOOKS_API_KEY) {
        console.error("❌ GOOGLE_BOOKS_API_KEY not set, skipping books");
        return { success: 0, skipped: 0, failed: 0 };
    }

    // Fetch from multiple queries to get variety
    const queries = [
        'subject:fiction bestseller',
        'subject:science fiction classic',
        'subject:fantasy epic',
        'subject:mystery thriller',
        'subject:biography',
        'subject:history',
        'subject:self-help',
        'subject:romance'
    ];

    const allBooks: GoogleBook[] = [];
    for (const query of queries) {
        const books = await fetchGoogleBooks(query, 40);
        allBooks.push(...books);
        await sleep(API_DELAY_MS);
    }

    // Dedupe by ID
    const bookMap = new Map<string, GoogleBook>();
    allBooks.forEach(b => bookMap.set(b.id, b));
    const books = Array.from(bookMap.values()).slice(0, 200); // Limit to 200

    console.log(`📊 Found ${books.length} unique books`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < books.length; i++) {
        const book = books[i];

        // Check existence
        if (await checkItemExists(supabase, 'google_books', book.id)) {
            skipped++;
            continue;
        }

        // Generate embedding
        const text = `${book.title} by ${book.authors.join(', ')}: ${book.description}`;
        const embedding = await generateEmbedding(text);

        if (!embedding) {
            console.error(`❌ Failed to embed: ${book.title}`);
            failed++;
            continue;
        }

        // Format and insert
        const item: GlobalItem = {
            title: book.title,
            description: book.description,
            image_url: book.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
            category_type: 'book',
            external_ids: { google_books: book.id },
            metadata: {
                authors: book.authors,
                published_date: book.publishedDate,
                rating: book.averageRating,
                source: 'google_books_seed'
            },
            embedding
        };

        if (await insertItem(supabase, item)) {
            success++;
        } else {
            failed++;
        }

        if ((i + 1) % 25 === 0) {
            console.log(`📚 Books: ${i + 1}/${books.length} processed (${success} added, ${skipped} skipped)`);
        }

        await sleep(EMBED_DELAY_MS);
    }

    console.log(`✅ Books complete: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log("🚀 CURATOR CONTENT SEEDING SCRIPT");
    console.log("=".repeat(50));

    // Validate API keys
    if (!VOYAGE_API_KEY) {
        console.error("❌ VOYAGE_API_KEY is required");
        process.exit(1);
    }

    const supabase = createServiceRoleClient();

    // Seed each content type
    const movieStats = await seedMovies(supabase);
    const boardGameStats = await seedBoardGames(supabase);
    const bookStats = await seedBooks(supabase);

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 SEEDING COMPLETE - SUMMARY");
    console.log("=".repeat(50));
    console.log(`🎬 Movies:      ${movieStats.success} added, ${movieStats.skipped} skipped, ${movieStats.failed} failed`);
    console.log(`🎲 Board Games: ${boardGameStats.success} added, ${boardGameStats.skipped} skipped, ${boardGameStats.failed} failed`);
    console.log(`📚 Books:       ${bookStats.success} added, ${bookStats.skipped} skipped, ${bookStats.failed} failed`);
    console.log("=".repeat(50));

    const total = movieStats.success + boardGameStats.success + bookStats.success;
    console.log(`✅ Total items added: ${total}`);
}

main().catch(err => {
    console.error("💥 Fatal error:", err);
    process.exit(1);
});
