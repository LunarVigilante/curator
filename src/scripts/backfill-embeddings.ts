import 'dotenv/config';
import { createServiceRoleClient } from '../lib/supabase/service-role';

/**
 * Backfill script for generating embeddings for existing items using Voyage AI.
 * Uses voyage-3 model (1024 dimensions) with batch support.
 */

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-3"; // 1024 dimensions
const BATCH_SIZE = 50; // Voyage allows up to 128, but 50 is safer for large texts
const DELAY_MS = 500; // 500ms delay between batches

if (!VOYAGE_API_KEY) {
    console.error("❌ Error: VOYAGE_API_KEY is not set in environment variables.");
    process.exit(1);
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

interface ItemToEmbed {
    id: string;
    title: string;
    description: string | null;
    cached_tags: Array<{ id: string; name: string }> | null;
}

async function generateEmbeddingsBatch(texts: string[]): Promise<number[][] | null> {
    try {
        const response = await fetch(VOYAGE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${VOYAGE_API_KEY}`,
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: texts, // Voyage requires input as array
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Voyage API Error: ${response.status}`, errorText);
            return null;
        }

        const data: VoyageEmbeddingResponse = await response.json();
        // Sort by index to ensure correct order
        return data.data
            .sort((a, b) => a.index - b.index)
            .map(item => item.embedding);
    } catch (error) {
        console.error("❌ Network Error during embedding generation:", error);
        return null;
    }
}

async function backfill() {
    const supabase = createServiceRoleClient();

    console.log("🔍 Fetching items without embeddings...");

    // Fetch ALL items to regenerate embeddings with new format (includes tags)
    const { data: items, error: fetchError } = await supabase
        .from('global_items')
        .select('id, title, description, cached_tags');

    if (fetchError) {
        console.error("❌ Error fetching items:", fetchError);
        return;
    }

    if (!items || items.length === 0) {
        console.log("✅ No items found that require embeddings.");
        return;
    }

    const typedItems = items as unknown as ItemToEmbed[];
    console.log(`🚀 Found ${typedItems.length} items to process in batches of ${BATCH_SIZE}.`);

    let successCount = 0;
    let failCount = 0;
    let totalBatches = Math.ceil(typedItems.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, typedItems.length);
        const batch = typedItems.slice(start, end);

        console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (items ${start + 1}-${end})...`);

        // Prepare texts for this batch (now includes tags for richer semantic matching)
        const texts = batch.map(item => {
            const parts = [item.title];
            if (item.description) {
                parts.push(item.description);
            }
            if (item.cached_tags && item.cached_tags.length > 0) {
                const tagNames = item.cached_tags.map(t => t.name).join(', ');
                parts.push(`Tags: ${tagNames}`);
            }
            return parts.join('. ');
        });

        const embeddings = await generateEmbeddingsBatch(texts);

        if (!embeddings) {
            console.error(`❌ Batch ${batchIndex + 1} failed entirely.`);
            failCount += batch.length;
            continue;
        }

        // Update each item with its embedding
        for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            const embedding = embeddings[i];

            if (!embedding) {
                console.error(`❌ No embedding returned for item ${item.id}`);
                failCount++;
                continue;
            }

            const { error: updateError } = await (supabase.from('global_items') as any)
                .update({ embedding })
                .eq('id', item.id);

            if (updateError) {
                console.error(`❌ Error updating item ${item.id}:`, updateError);
                failCount++;
            } else {
                successCount++;
            }
        }

        console.log(`✅ Batch ${batchIndex + 1} complete. Running total: ${successCount} success, ${failCount} fail.`);

        // Delay between batches
        if (batchIndex < totalBatches - 1) {
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
