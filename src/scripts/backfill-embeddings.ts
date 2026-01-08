import 'dotenv/config';
import { createServiceRoleClient } from '../lib/supabase/service-role';

/**
 * Backfill script for generating embeddings for existing items in the database.
 * Uses OpenRouter with the mistralai/mistral-embed model.
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const EMBEDDING_MODEL = "mistralai/mistral-embed"; // 1024 dimensions
const BATCH_SIZE = 10;
const DELAY_MS = 1000; // 1 second delay between batches

if (!OPENROUTER_API_KEY) {
    console.error("❌ Error: OPENROUTER_API_KEY is not set in environment variables.");
    process.exit(1);
}

async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Curator App",
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: text,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`❌ OpenRouter API Error: ${response.status}`, errorData);
            return null;
        }

        const data = await response.json();
        return data.data[0].embedding;
    } catch (error) {
        console.error("❌ Network Error during embedding generation:", error);
        return null;
    }
}

async function backfill() {
    const supabase = createServiceRoleClient();

    console.log("🔍 Fetching items without embeddings...");

    // Fetch items that don't have embeddings
    const { data: items, error: fetchError } = await supabase
        .from('global_items')
        .select('id, title, description')
        .is('embedding', null);

    if (fetchError) {
        console.error("❌ Error fetching items:", fetchError);
        return;
    }

    if (!items || items.length === 0) {
        console.log("✅ No items found that require embeddings.");
        return;
    }

    console.log(`🚀 Found ${items.length} items to process.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i] as any;
        const text = item.description
            ? `${item.title}: ${item.description}`
            : item.title;

        console.log(`[${i + 1}/${items.length}] Processing: ${item.title}...`);

        const embedding = await generateEmbedding(text);

        if (embedding) {
            const { error: updateError } = await (supabase.from('global_items') as any)
                .update({ embedding: embedding })
                .eq('id', item.id);

            if (updateError) {
                console.error(`❌ Error updating item ${item.id}:`, updateError);
                failCount++;
            } else {
                successCount++;
            }
        } else {
            failCount++;
        }

        // Delay to avoid hitting rate limits too hard
        if (i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    console.log("\n--- Backfill Result ---");
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log("------------------------");
}

backfill().catch(err => {
    console.error("💥 Unhandled Error in backfill script:", err);
});
