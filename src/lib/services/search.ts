/**
 * Hybrid Search Service
 * 
 * Implements:
 * - Voyage-4 embedding generation (dimensions vary by output_dimension setting)
 * - Keyword search via Supabase textSearch
 * - Semantic search via match_documents RPC
 * - Reciprocal Rank Fusion (RRF) for hybrid results
 * - Langfuse tracing for AI observability
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { log } from 'next-axiom';

// ============================================================================
// CONFIGURATION
// ============================================================================

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-4';
// Voyage-4 is the latest model with improved performance

// RRF parameters
const RRF_K = 60; // Constant for RRF formula (typically 60)
const DEFAULT_MATCH_THRESHOLD = 0.5;
const DEFAULT_RESULT_COUNT = 20;

// ============================================================================
// TYPES
// ============================================================================

export interface SearchResult {
    id: string;
    title: string;
    imageUrl: string | null;
    categoryType: string;
    description?: string;
    score: number;
    source: 'keyword' | 'semantic' | 'hybrid';
}

export interface HybridSearchOptions {
    categoryFilter?: string;
    limit?: number;
    semanticWeight?: number; // 0-1, default 0.5
    keywordWeight?: number;  // 0-1, default 0.5
}

interface VoyageEmbeddingResponse {
    data: Array<{ embedding: number[]; index: number }>;
    model: string;
    usage: { total_tokens: number };
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding using Voyage-3 API.
 * 
 * @param text - Text to embed
 * @param inputType - 'document' for storage, 'query' for search
 * @returns Embedding vector (1024 dimensions) or null on error
 */
export async function generateEmbedding(
    text: string,
    inputType: 'document' | 'query' = 'document'
): Promise<number[] | null> {
    const apiKey = process.env.VOYAGE_API_KEY;
    const startTime = Date.now();

    if (!apiKey) {
        console.error('[Search] VOYAGE_API_KEY not configured');
        return null;
    }

    if (!text || text.trim().length === 0) {
        console.warn('[Search] Empty text provided for embedding');
        return null;
    }

    try {
        const response = await fetch(VOYAGE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: VOYAGE_MODEL,
                input: [text.slice(0, 120000)], // Voyage-4 max input (120k context)
                input_type: inputType,
            }),
        });

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Search] Voyage API error ${response.status}: ${errorText}`);
            log.error('[Voyage] Embedding generation failed', {
                model: VOYAGE_MODEL,
                inputType,
                status: response.status,
                latencyMs,
            });
            return null;
        }

        const data: VoyageEmbeddingResponse = await response.json();

        if (!data.data?.[0]?.embedding) {
            console.error('[Search] No embedding in Voyage response');
            return null;
        }

        // Log successful embedding generation for observability
        log.info('[Voyage] Embedding generated', {
            model: VOYAGE_MODEL,
            inputType,
            dimensions: data.data[0].embedding.length,
            tokens: data.usage?.total_tokens,
            latencyMs,
        });

        return data.data[0].embedding;
    } catch (error) {
        console.error('[Search] Error generating embedding:', error);
        log.error('[Voyage] Embedding exception', {
            model: VOYAGE_MODEL,
            inputType,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/**
 * Generate embeddings for multiple texts in batch.
 */
export async function generateEmbeddingsBatch(
    texts: string[],
    inputType: 'document' | 'query' = 'document'
): Promise<(number[] | null)[]> {
    const apiKey = process.env.VOYAGE_API_KEY;

    if (!apiKey) {
        console.error('[Search] VOYAGE_API_KEY not configured');
        return texts.map(() => null);
    }

    const validTexts = texts.map(t => t?.slice(0, 32000) || '');

    try {
        const response = await fetch(VOYAGE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: VOYAGE_MODEL,
                input: validTexts,
                input_type: inputType,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Search] Voyage batch API error ${response.status}: ${errorText}`);
            return texts.map(() => null);
        }

        const data: VoyageEmbeddingResponse = await response.json();

        return texts.map((_text, index) => {
            const item = data.data?.find(d => d.index === index);
            return item?.embedding || null;
        });
    } catch (error) {
        console.error('[Search] Error generating batch embeddings:', error);
        return texts.map(() => null);
    }
}

// ============================================================================
// KEYWORD SEARCH
// ============================================================================

/**
 * Perform keyword search using Supabase full-text search.
 */
async function keywordSearch(
    query: string,
    options: HybridSearchOptions = {}
): Promise<SearchResult[]> {
    const supabase = await createClient();
    const { categoryFilter, limit = DEFAULT_RESULT_COUNT } = options;

    try {
        // Build query - using textSearch on title and description
        // Note: Using 'as any' because Supabase types may not include textSearch method
        let dbQuery = (supabase
            .from('global_items')
            .select('id, title, image_url, category_type, description') as any)
            .textSearch('title', query, { type: 'websearch', config: 'english' })
            .limit(limit * 2); // Fetch more for merging

        if (categoryFilter) {
            dbQuery = dbQuery.eq('category_type', categoryFilter);
        }

        const { data, error } = await dbQuery;

        if (error) {
            console.error('[Search] Keyword search error:', error);
            return [];
        }

        // Assign rank-based scores (1-indexed)
        type GlobalItemRow = { id: string; title: string; image_url: string | null; category_type: string; description: string | null };
        return ((data || []) as GlobalItemRow[]).map((item, index) => ({
            id: item.id,
            title: item.title,
            imageUrl: item.image_url,
            categoryType: item.category_type,
            description: item.description ?? undefined,
            score: 1 / (index + 1), // Simple positional score
            source: 'keyword' as const,
        }));
    } catch (error) {
        console.error('[Search] Keyword search exception:', error);
        return [];
    }
}


// ============================================================================
// SEMANTIC SEARCH
// ============================================================================

/**
 * Perform semantic search using vector similarity.
 */
async function semanticSearch(
    query: string,
    options: HybridSearchOptions = {}
): Promise<SearchResult[]> {
    const supabase = await createClient();
    const { categoryFilter, limit = DEFAULT_RESULT_COUNT } = options;

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, 'query');

    if (!queryEmbedding) {
        console.warn('[Search] Could not generate query embedding');
        return [];
    }

    try {
        const { data, error } = await (supabase.rpc as any)('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: DEFAULT_MATCH_THRESHOLD,
            match_count: limit * 2,
            category_filter: categoryFilter || null,
        });

        if (error) {
            console.error('[Search] Semantic search error:', error);
            return [];
        }

        return (data || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            imageUrl: item.image_url,
            categoryType: item.category_type,
            description: item.description,
            score: item.similarity,
            source: 'semantic' as const,
        }));
    } catch (error) {
        console.error('[Search] Semantic search exception:', error);
        return [];
    }
}

// ============================================================================
// RECIPROCAL RANK FUSION (RRF)
// ============================================================================

/**
 * Merge results from multiple sources using Reciprocal Rank Fusion.
 * 
 * RRF formula: score = Σ (1 / (k + rank))
 * where k is a constant (typically 60) and rank is 1-indexed position.
 */
function reciprocalRankFusion(
    resultSets: SearchResult[][],
    weights: number[] = []
): SearchResult[] {
    const scoreMap = new Map<string, {
        item: SearchResult;
        rrfScore: number;
        sources: Set<string>;
    }>();

    // Normalize weights or use equal weights
    const normalizedWeights = weights.length === resultSets.length
        ? weights
        : resultSets.map(() => 1 / resultSets.length);

    // Process each result set
    resultSets.forEach((results, setIndex) => {
        const weight = normalizedWeights[setIndex];

        results.forEach((result, rank) => {
            const rrfContribution = weight / (RRF_K + rank + 1); // rank is 0-indexed, add 1

            const existing = scoreMap.get(result.id);
            if (existing) {
                existing.rrfScore += rrfContribution;
                existing.sources.add(result.source);
            } else {
                scoreMap.set(result.id, {
                    item: result,
                    rrfScore: rrfContribution,
                    sources: new Set([result.source]),
                });
            }
        });
    });

    // Convert to array and sort by RRF score
    return Array.from(scoreMap.values())
        .sort((a, b) => b.rrfScore - a.rrfScore)
        .map(({ item, rrfScore, sources }) => ({
            ...item,
            score: rrfScore,
            source: sources.size > 1 ? 'hybrid' as const : item.source,
        }));
}

// ============================================================================
// HYBRID SEARCH (PUBLIC API)
// ============================================================================

/**
 * Perform hybrid search combining keyword and semantic search.
 * Results are merged using Reciprocal Rank Fusion (RRF).
 * 
 * @example
 * const results = await searchItems('Sad sci-fi movies from the 90s', {
 *   categoryFilter: 'movie',
 *   limit: 20,
 *   semanticWeight: 0.6,
 *   keywordWeight: 0.4,
 * });
 */
export async function searchItems(
    query: string,
    options: HybridSearchOptions = {}
): Promise<SearchResult[]> {
    const {
        limit = DEFAULT_RESULT_COUNT,
        semanticWeight = 0.5,
        keywordWeight = 0.5,
    } = options;

    // Run keyword and semantic search in parallel
    const [keywordResults, semanticResults] = await Promise.all([
        keywordSearch(query, options),
        semanticSearch(query, options),
    ]);

    // Merge using RRF
    const fusedResults = reciprocalRankFusion(
        [keywordResults, semanticResults],
        [keywordWeight, semanticWeight]
    );

    // Return top N results
    return fusedResults.slice(0, limit);
}

/**
 * Find similar items to a given item ID.
 */
export async function findSimilarItems(
    itemId: string,
    options: { limit?: number; categoryFilter?: string } = {}
): Promise<SearchResult[]> {
    const supabase = await createClient();
    const { limit = 10, categoryFilter } = options;

    try {
        const { data, error } = await (supabase.rpc as any)('find_similar_items', {
            source_item_id: itemId,
            match_count: limit,
            category_filter: categoryFilter || null,
        });

        if (error) {
            console.error('[Search] Find similar items error:', error);
            return [];
        }

        return (data || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            imageUrl: item.image_url,
            categoryType: item.category_type,
            score: item.similarity,
            source: 'semantic' as const,
        }));
    } catch (error) {
        console.error('[Search] Find similar items exception:', error);
        return [];
    }
}

// ============================================================================
// EMBEDDING MANAGEMENT
// ============================================================================

/**
 * Generate and store embedding for a global item.
 * Uses service role client for write access.
 */
export async function embedGlobalItem(
    itemId: string,
    text: string
): Promise<boolean> {
    const supabase = createServiceRoleClient();

    const embedding = await generateEmbedding(text, 'document');

    if (!embedding) {
        console.error(`[Search] Failed to generate embedding for item ${itemId}`);
        return false;
    }

    // Note: Using 'as any' because embedding column may not be in generated types yet
    const { error } = await (supabase
        .from('global_items') as any)
        .update({ embedding })
        .eq('id', itemId);

    if (error) {
        console.error(`[Search] Failed to store embedding for item ${itemId}:`, error);
        return false;
    }

    return true;
}

/**
 * Batch embed multiple items.
 */
export async function embedGlobalItemsBatch(
    items: Array<{ id: string; text: string }>
): Promise<{ success: number; failed: number }> {
    const supabase = createServiceRoleClient();
    let success = 0;
    let failed = 0;

    // Process in batches of 8 (Voyage batch limit considerations)
    const batchSize = 8;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const texts = batch.map(item => item.text);

        const embeddings = await generateEmbeddingsBatch(texts, 'document');

        const updatePromises = batch.map(async (item, j) => {
            const embedding = embeddings[j];

            if (!embedding) {
                return false;
            }

            // Note: Using 'as any' because embedding column may not be in generated types yet
            const { error } = await (supabase
                .from('global_items') as any)
                .update({ embedding })
                .eq('id', item.id);

            return !error;
        });

        const results = await Promise.all(updatePromises);

        results.forEach((isSuccess) => {
            if (isSuccess) {
                success++;
            } else {
                failed++;
            }
        });

        // Small delay between batches to avoid rate limits
        if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    return { success, failed };
}
