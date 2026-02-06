import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Batch Embedding Edge Function (v4.6)
 * 
 * Generates vector embeddings for multiple items in a single request.
 * Implements intelligent fallback: if batch fails, retry individually.
 * 
 * Features:
 * - Batch up to 128 texts per Voyage API call
 * - Automatic fallback to individual embedding on batch failure
 * - Exponential backoff on rate limits
 * - Partial success tracking
 */

const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY");
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-3"; // 1024 dimensions
const MAX_BATCH_SIZE = 128;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
// TPM Safeguards (v4.6 - addresses Token Exhaustion risk)
const INTER_BATCH_DELAY_MS = 500;  // Delay between consecutive batches to avoid TPM limits
const TPM_SAFE_BATCH_SIZE = 64;    // Conservative batch size for large harvests

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface BatchRequest {
    items: Array<{
        id: string;
        text: string;
    }>;
    // v4.6: Optional TPM-safe mode for large harvests
    tpm_safe?: boolean; // Use conservative batch size (64) to avoid token exhaustion
}

interface VoyageEmbeddingResponse {
    object: string;
    data: Array<{
        object: string;
        embedding: number[];
        index: number;
    }>;
    model: string;
    usage: {
        total_tokens: number;
    };
}

// Error codes for partial failure tracking (v4.6)
// Callers can use these to set sync_status on specific items
type EmbeddingErrorCode =
    | 'RATE_LIMITED'      // 429 - Voyage rate limit
    | 'TOKEN_LIMIT'       // Text exceeds token limit
    | 'EMBEDDING_FAILED'  // Generic embedding failure
    | 'DB_UPDATE_FAILED'  // Supabase update failed
    | 'RETRIES_EXHAUSTED' // Max retries reached
    | 'UNKNOWN';          // Unexpected error

interface EmbeddingResult {
    id: string;
    success: boolean;
    embedding?: number[];
    error?: string;
    error_code?: EmbeddingErrorCode; // v4.6: For sync_status tracking
}

/**
 * Generate embeddings for a batch of texts with Voyage API
 * Includes internal retry loop with Retry-After handling
 */
async function generateBatchEmbeddings(texts: string[], retries = MAX_RETRIES): Promise<number[][] | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(VOYAGE_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${VOYAGE_API_KEY}`,
                },
                body: JSON.stringify({
                    model: EMBEDDING_MODEL,
                    input: texts,
                }),
            });

            // Handle rate limiting with Retry-After (v4.6 fix)
            if (response.status === 429) {
                const retryAfterHeader = response.headers.get("Retry-After");
                const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 30;
                console.log(`⏸️ Batch rate limited (429). Waiting ${retryAfterSeconds}s as per Retry-After header...`);
                await new Promise(r => setTimeout(r, retryAfterSeconds * 1000));
                continue; // Retry after waiting
            }

            // Handle token limit errors with specific error code
            if (response.status === 400) {
                const errorBody = await response.text();
                if (errorBody.includes("token") || errorBody.includes("limit")) {
                    console.error(`🚫 Batch exceeds token limit: ${errorBody}`);
                    // Return null to trigger individual fallback
                    return null;
                }
            }

            if (!response.ok) {
                const error = await response.text();
                console.error(`Voyage API batch error: ${response.status}`, error);
                // Don't retry on non-retryable errors
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    return null;
                }
                throw new Error(`Voyage API error: ${response.status}`);
            }

            const data: VoyageEmbeddingResponse = await response.json();
            // Sort by index to ensure correct ordering
            console.log(`✅ Batch embedding successful: ${data.data.length} embeddings, ${data.usage.total_tokens} tokens used`);
            return data.data
                .sort((a, b) => a.index - b.index)
                .map(d => d.embedding);
        } catch (err) {
            const error = err as Error;
            const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
            console.log(`🔄 Batch retry ${attempt + 1}/${retries} after ${delay}ms: ${error.message}`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    console.error(`❌ Batch embedding failed after ${retries} retries`);
    return null;
}

/**
 * Generate a single embedding with retries
 */
async function generateSingleEmbedding(text: string, retries = MAX_RETRIES): Promise<number[] | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
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

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get("Retry-After") || "30", 10);
                console.log(`Rate limited, pausing ${retryAfter}s...`);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                continue;
            }

            if (!response.ok) {
                throw new Error(`Voyage error: ${response.status}`);
            }

            const data: VoyageEmbeddingResponse = await response.json();
            return data.data[0].embedding;
        } catch (err) {
            const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
            console.log(`Retry ${attempt + 1}/${retries} after ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    return null;
}

/**
 * Process batch with fallback to individual on failure
 */
async function processBatchWithFallback(
    items: Array<{ id: string; text: string }>
): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    // Attempt batch embedding first
    try {
        console.log(`🚀 Batch embedding ${items.length} items...`);
        const texts = items.map(i => i.text);
        const embeddings = await generateBatchEmbeddings(texts);

        if (embeddings && embeddings.length === items.length) {
            // Batch success - save all embeddings
            for (let i = 0; i < items.length; i++) {
                const { error } = await supabase
                    .from("global_items")
                    .update({ embedding: embeddings[i] })
                    .eq("id", items[i].id);

                results.push({
                    id: items[i].id,
                    success: !error,
                    embedding: embeddings[i],
                    error: error?.message,
                    error_code: error ? 'DB_UPDATE_FAILED' : undefined,
                });
            }
            console.log(`✅ Batch success: ${results.filter(r => r.success).length}/${items.length}`);
            return results;
        }
    } catch (err) {
        const error = err as Error;
        console.warn(`⚠️ Batch failed: ${error.message}. Falling back to individual...`);
    }

    // Fallback: Process individually
    console.log(`🔄 Individual fallback for ${items.length} items...`);
    for (const item of items) {
        try {
            const embedding = await generateSingleEmbedding(item.text);

            if (embedding) {
                const { error } = await supabase
                    .from("global_items")
                    .update({ embedding })
                    .eq("id", item.id);

                results.push({
                    id: item.id,
                    success: !error,
                    embedding,
                    error: error?.message,
                    error_code: error ? 'DB_UPDATE_FAILED' : undefined,
                });
            } else {
                results.push({
                    id: item.id,
                    success: false,
                    error: "Failed to generate embedding after retries",
                    error_code: 'RETRIES_EXHAUSTED',
                });
            }
        } catch (err) {
            const error = err as Error;
            const errorCode: EmbeddingErrorCode = error.message.includes('429')
                ? 'RATE_LIMITED'
                : error.message.includes('token')
                    ? 'TOKEN_LIMIT'
                    : 'EMBEDDING_FAILED';
            results.push({
                id: item.id,
                success: false,
                error: error.message,
                error_code: errorCode,
            });
        }
    }

    console.log(`📊 Individual fallback complete: ${results.filter(r => r.success).length}/${items.length} succeeded`);
    return results;
}

Deno.serve(async (req: Request) => {
    try {
        if (!VOYAGE_API_KEY) {
            throw new Error("VOYAGE_API_KEY is not set");
        }

        const payload: BatchRequest = await req.json();
        const { items, tpm_safe } = payload;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return new Response(
                JSON.stringify({ error: "items array required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // v4.6: Use TPM-safe batch size for large harvests (prevents token exhaustion)
        const effectiveMaxSize = tpm_safe ? TPM_SAFE_BATCH_SIZE : MAX_BATCH_SIZE;
        const batch = items.slice(0, effectiveMaxSize);
        if (items.length > effectiveMaxSize) {
            console.warn(`Truncated batch from ${items.length} to ${effectiveMaxSize}${tpm_safe ? ' (TPM-safe mode)' : ''}`);
        }

        console.log(`📥 Received batch of ${batch.length} items${tpm_safe ? ' [TPM-SAFE]' : ''}`);

        const results = await processBatchWithFallback(batch);

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        return new Response(
            JSON.stringify({
                success: failureCount === 0,
                processed: batch.length,
                succeeded: successCount,
                failed: failureCount,
                results: results.map(r => ({
                    id: r.id,
                    success: r.success,
                    dimensions: r.embedding?.length,
                    error: r.error,
                    error_code: r.error_code, // v4.6: For sync_status tracking
                })),
            }),
            {
                status: failureCount === batch.length ? 500 : 200,
                headers: { "Content-Type": "application/json" }
            }
        );
    } catch (err) {
        const error = err as Error;
        console.error("Batch embedding error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
