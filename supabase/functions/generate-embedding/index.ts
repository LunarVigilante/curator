import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

// OpenRouter-compatible client using OpenAI SDK
const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: Deno.env.get("OPENROUTER_API_KEY"),
});

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Embedding model - 1024 dimensions
// Options: mistralai/mistral-embed, cohere/embed-english-v3.0
const EMBEDDING_MODEL = "mistralai/mistral-embed";

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

Deno.serve(async (req: Request) => {
    try {
        const payload: WebhookPayload = await req.json();
        const { record, type } = payload;

        // Skip if no title or already has embedding (unless description changed)
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

        // Construct text for embedding: "Title: Description"
        const text = record.description
            ? `${record.title}: ${record.description}`
            : record.title;

        console.log(`Generating embedding for: ${record.id} - "${text.slice(0, 50)}..."`);

        // Generate embedding via OpenRouter
        const response = await openrouter.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text,
        });

        const embedding = response.data[0].embedding;

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
    } catch (error) {
        console.error("Embedding generation error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
