import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY");
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-3"; // 1024 dimensions

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface WebhookPayload {
    type: "INSERT" | "UPDATE";
    table: string;
    record: {
        id: string;
        title?: string;
        description?: string;
        embedding?: number[];
    };
    old_record?: Record<string, unknown>;
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

async function generateEmbedding(text: string): Promise<number[] | null> {
    const response = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: [text], // Voyage requires input as array
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
    try {
        if (!VOYAGE_API_KEY) {
            throw new Error("VOYAGE_API_KEY is not set");
        }

        const payload: WebhookPayload = await req.json();
        const { record, type } = payload;

        // Skip if no title
        if (!record?.id || !record?.title) {
            return new Response(
                JSON.stringify({ skipped: true, reason: "no title" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        // Skip updates that don't change title/description
        if (type === "UPDATE" && record.embedding) {
            const oldRecord = payload.old_record;
            if (
                oldRecord?.title === record.title &&
                oldRecord?.description === record.description
            ) {
                return new Response(
                    JSON.stringify({ skipped: true, reason: "no content change" }),
                    { status: 200, headers: { "Content-Type": "application/json" } }
                );
            }
        }

        // Construct text for embedding
        const text = record.description
            ? `${record.title}: ${record.description}`
            : record.title;

        console.log(`Generating embedding for: ${record.id} - "${text.slice(0, 50)}..."`);

        const embedding = await generateEmbedding(text);

        if (!embedding) {
            throw new Error("Failed to generate embedding");
        }

        // Save embedding back to database
        const { error } = await supabase
            .from("global_items")
            .update({ embedding })
            .eq("id", record.id);

        if (error) {
            console.error("Database update error:", error);
            throw error;
        }

        console.log(`Embedding saved: ${record.id} (${embedding.length} dimensions)`);

        return new Response(
            JSON.stringify({
                success: true,
                id: record.id,
                dimensions: embedding.length,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (err) {
        const error = err as Error;
        console.error("Embedding generation error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
