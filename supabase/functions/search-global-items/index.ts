import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY");
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-3";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface SearchRequest {
    query: string;
    matchThreshold?: number;
    matchCount?: number;
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

interface SearchResultItem {
    id: string;
    title: string;
    posterUrl: string | null;
    similarity: number;
}

async function generateQueryEmbedding(text: string): Promise<number[] | null> {
    const response = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: [text],
            input_type: "query", // Optimized for search queries
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error(`Voyage API error: ${response.status}`, error);
        return null;
    }

    const data: VoyageEmbeddingResponse = await response.json();
    return data.data[0].embedding;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    try {
        if (!VOYAGE_API_KEY) {
            throw new Error("VOYAGE_API_KEY is not configured");
        }

        const { query, matchThreshold = 0.7, matchCount = 10 }: SearchRequest = await req.json();

        if (!query || typeof query !== "string") {
            return new Response(
                JSON.stringify({ error: "Missing or invalid 'query' parameter" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        console.log(`Searching for: "${query.slice(0, 50)}..."`);

        // Step 1: Generate embedding for the search query
        const embedding = await generateQueryEmbedding(query);

        if (!embedding) {
            throw new Error("Failed to generate embedding for query");
        }

        console.log(`Embedding generated: ${embedding.length} dimensions`);

        // Step 2: Call the database RPC function
        const { data, error } = await supabase.rpc("search_items_by_vector", {
            query_embedding: embedding,
            match_threshold: matchThreshold,
            match_count: matchCount,
        });

        if (error) {
            console.error("Database search error:", error);
            throw error;
        }

        const results: SearchResultItem[] = data || [];

        console.log(`Found ${results.length} results`);

        return new Response(
            JSON.stringify({
                success: true,
                query,
                results,
                count: results.length,
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (err) {
        const error = err as Error;
        console.error("Search error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    }
});
