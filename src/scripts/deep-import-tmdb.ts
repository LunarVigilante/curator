import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createServiceRoleClient } from '../lib/supabase/service-role';
import { callLLM } from '../lib/llm';
import { SystemConfigService } from '../lib/services/SystemConfigService';

/**
 * Deep TMDB Import Script
 * 
 * Features:
 * - Checkpoint system: Resume from where you left off
 * - Rate limiting: Respects TMDB API limits
 * - Upsert logic: Updates existing items, creates new ones
 * - Optional embeddings: Skip with --no-embeddings flag
 * - Data quality: Only imports movies with vote_count > 50
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-3";

const CURSOR_FILE = path.join(__dirname, 'import-cursor.json');
const PAGE_DELAY_MS = 2000;      // 2 seconds between pages
const MOVIE_DELAY_MS = 500;      // 500ms between movies
const MIN_VOTE_COUNT = 50;       // Minimum votes to import
const MAX_PAGES = 500;           // Maximum pages to fetch (20 movies per page = 10,000 movies)

// Parse CLI flags
const SKIP_EMBEDDINGS = process.argv.includes('--no-embeddings');
const START_FRESH = process.argv.includes('--fresh');

// ============================================================================
// TYPES
// ============================================================================

interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    release_date: string;
    vote_count: number;
    vote_average: number;
    genre_ids: number[];
    popularity: number;
    original_language: string;
}

interface TMDBResponse {
    page: number;
    results: TMDBMovie[];
    total_pages: number;
    total_results: number;
}

interface Cursor {
    currentPage: number;
    totalProcessed: number;
    lastUpdated: string;
}

interface GlobalItem {
    title: string;
    description: string;
    image_url: string | null;
    category_type: string;
    external_ids: Record<string, any>;
    metadata: Record<string, any>;
    embedding?: number[];
}

// ============================================================================
// CURSOR MANAGEMENT
// ============================================================================

function loadCursor(): Cursor {
    if (START_FRESH) {
        console.log('🔄 Starting fresh (--fresh flag detected)');
        return { currentPage: 1, totalProcessed: 0, lastUpdated: new Date().toISOString() };
    }

    try {
        if (fs.existsSync(CURSOR_FILE)) {
            const data = fs.readFileSync(CURSOR_FILE, 'utf-8');
            const cursor = JSON.parse(data) as Cursor;
            console.log(`📍 Resuming from page ${cursor.currentPage} (${cursor.totalProcessed} already processed)`);
            return cursor;
        }
    } catch (error) {
        console.warn('⚠️ Could not load cursor file, starting fresh');
    }
    return { currentPage: 1, totalProcessed: 0, lastUpdated: new Date().toISOString() };
}

function saveCursor(cursor: Cursor): void {
    cursor.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursor, null, 2));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// LLM Config cache
let llmConfig: { provider: string; apiKey: string; model?: string; endpoint?: string } | null = null;

async function getLLMConfig() {
    if (llmConfig) return llmConfig;

    const provider = await SystemConfigService.getDecryptedConfig('llm_provider') || 'openrouter';
    let apiKey = await SystemConfigService.getDecryptedConfig('llm_api_key');
    const model = await SystemConfigService.getDecryptedConfig('llm_model');
    const endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint');

    if (!apiKey) {
        switch (provider) {
            case 'anthropic': apiKey = await SystemConfigService.getDecryptedConfig('anthropic_api_key'); break;
            case 'openai': apiKey = await SystemConfigService.getDecryptedConfig('openai_api_key'); break;
            case 'openrouter': apiKey = await SystemConfigService.getDecryptedConfig('openrouter_api_key'); break;
            case 'google': apiKey = await SystemConfigService.getDecryptedConfig('google_ai_api_key'); break;
        }
    }

    if (!apiKey) {
        apiKey = await SystemConfigService.getDecryptedConfig('openrouter_api_key') ||
            await SystemConfigService.getDecryptedConfig('anthropic_api_key') ||
            await SystemConfigService.getDecryptedConfig('openai_api_key') ||
            await SystemConfigService.getDecryptedConfig('google_ai_api_key') || '';
    }

    llmConfig = { provider, apiKey, model: model || undefined, endpoint: endpoint || undefined };
    return llmConfig;
}

async function generateDescription(title: string, originalOverview: string): Promise<string> {
    try {
        const config = await getLLMConfig();
        if (!config.apiKey) return originalOverview;

        const systemPrompt = `You are an expert curator and critic. Generate a compelling description for the given item.

DESCRIPTION FORMAT:
1. Body: Maximum 50 words. Focus on plot summary first, then the vibe/atmosphere.
2. Footer: After the body, append exactly this format on a new line after a double newline:

Year: YYYY | Creator: [Name] | Notable Awards: [Awards or "None"]

Return ONLY the description text. No JSON, no markdown, no quotes.`;

        const userPrompt = `Generate a description for:
Title: ${title}
Type: Movie
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
        return description.length > 20 ? description : originalOverview;
    } catch (error) {
        console.warn(`⚠️ Description failed for "${title}"`);
        return originalOverview;
    }
}

async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!VOYAGE_API_KEY) return null;

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

        if (!response.ok) return null;

        const data = await response.json();
        return data.data?.[0]?.embedding || null;
    } catch {
        return null;
    }
}

// ============================================================================
// TMDB FETCHING
// ============================================================================

async function fetchTMDBPage(page: number): Promise<TMDBResponse | null> {
    const url = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 429) {
                console.warn('⚠️ Rate limited by TMDB, waiting 10 seconds...');
                await sleep(10000);
                return fetchTMDBPage(page); // Retry
            }
            throw new Error(`TMDB error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`❌ Failed to fetch page ${page}:`, error);
        return null;
    }
}

// ============================================================================
// MAIN IMPORT LOGIC
// ============================================================================

async function importMovie(supabase: any, movie: TMDBMovie): Promise<boolean> {
    // Filter by vote count
    if (movie.vote_count < MIN_VOTE_COUNT) {
        return false; // Skipped
    }

    // Generate description (uses LLM if configured)
    const description = await generateDescription(movie.title, movie.overview);

    // Generate embedding (if enabled)
    let embedding: number[] | null = null;
    if (!SKIP_EMBEDDINGS) {
        const text = `${movie.title}: ${description}`;
        embedding = await generateEmbedding(text);
    }

    // Prepare item for upsert
    const item: GlobalItem = {
        title: movie.title,
        description,
        image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        category_type: 'MOVIE',
        external_ids: { tmdb: movie.id },
        metadata: {
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count,
            popularity: movie.popularity,
            original_language: movie.original_language,
            genre_ids: movie.genre_ids,
            source: 'tmdb_deep_import',
            original_overview: movie.overview
        }
    };

    if (embedding) {
        item.embedding = embedding;
    }

    // Upsert: Check if exists first, then update or insert
    const { data: existing } = await supabase
        .from('global_items')
        .select('id')
        .contains('external_ids', { tmdb: movie.id })
        .limit(1);

    if (existing && existing.length > 0) {
        // Update existing
        const { error } = await (supabase.from('global_items') as any)
            .update({
                description: item.description,
                image_url: item.image_url,
                metadata: item.metadata,
                ...(embedding ? { embedding } : {})
            })
            .eq('id', existing[0].id);

        if (error) {
            console.error(`❌ Update failed for "${movie.title}":`, error.message);
            return false;
        }
    } else {
        // Insert new
        const { error } = await (supabase.from('global_items') as any).insert(item);

        if (error) {
            console.error(`❌ Insert failed for "${movie.title}":`, error.message);
            return false;
        }
    }

    return true;
}

async function main() {
    console.log('🎬 TMDB DEEP IMPORT SCRIPT');
    console.log('═'.repeat(60));
    console.log(`📋 Settings:`);
    console.log(`   • Max pages: ${MAX_PAGES}`);
    console.log(`   • Min vote count: ${MIN_VOTE_COUNT}`);
    console.log(`   • Embeddings: ${SKIP_EMBEDDINGS ? 'DISABLED (--no-embeddings)' : 'ENABLED'}`);
    console.log(`   • Page delay: ${PAGE_DELAY_MS}ms`);
    console.log(`   • Movie delay: ${MOVIE_DELAY_MS}ms`);
    console.log('═'.repeat(60));

    if (!TMDB_API_KEY) {
        console.error('❌ TMDB_API_KEY is required');
        process.exit(1);
    }

    const supabase = createServiceRoleClient();
    const cursor = loadCursor();

    let totalProcessed = cursor.totalProcessed;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // Pre-load LLM config
    console.log('🔧 Loading LLM configuration...');
    const llmConf = await getLLMConfig();
    console.log(`   • Provider: ${llmConf.provider}`);
    console.log(`   • API Key: ${llmConf.apiKey ? '✓ configured' : '✗ not configured'}`);
    console.log('═'.repeat(60));

    for (let page = cursor.currentPage; page <= MAX_PAGES; page++) {
        // Fetch page
        const response = await fetchTMDBPage(page);

        if (!response || !response.results) {
            console.error(`❌ Failed to fetch page ${page}, skipping...`);
            continue;
        }

        const totalPages = Math.min(response.total_pages, MAX_PAGES);
        const movies = response.results;
        let pageProcessed = 0;
        let pageInserted = 0;

        console.log(`\n📄 Page ${page}/${totalPages}: Processing ${movies.length} movies...`);

        for (const movie of movies) {
            const success = await importMovie(supabase, movie);

            if (success) {
                pageInserted++;
                totalInserted++;
            } else if (movie.vote_count < MIN_VOTE_COUNT) {
                totalSkipped++;
            } else {
                totalFailed++;
            }

            pageProcessed++;
            totalProcessed++;

            // Rate limit between movies
            await sleep(MOVIE_DELAY_MS);
        }

        // Progress log
        const progress = ((page / totalPages) * 100).toFixed(1);
        console.log(`   ✅ Page ${page}/${totalPages}: ${pageInserted}/${pageProcessed} inserted (Total: ${totalProcessed}) [${progress}%]`);

        // Save checkpoint after each page
        cursor.currentPage = page + 1;
        cursor.totalProcessed = totalProcessed;
        saveCursor(cursor);

        // Check if we've reached the end
        if (page >= response.total_pages) {
            console.log('\n🎉 Reached end of TMDB results!');
            break;
        }

        // Rate limit between pages
        await sleep(PAGE_DELAY_MS);
    }

    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 IMPORT COMPLETE - SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   ✅ Total processed: ${totalProcessed}`);
    console.log(`   📥 Inserted/Updated: ${totalInserted}`);
    console.log(`   ⏭️  Skipped (low votes): ${totalSkipped}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log('═'.repeat(60));

    // Clean up cursor file on completion
    if (cursor.currentPage > MAX_PAGES) {
        console.log('🧹 Cleaning up cursor file...');
        if (fs.existsSync(CURSOR_FILE)) {
            fs.unlinkSync(CURSOR_FILE);
        }
    }
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
