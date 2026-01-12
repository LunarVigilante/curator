import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { callLLM } from '@/lib/llm';
import { decrypt } from '@/lib/encryption';

/**
 * Backfill script for regenerating descriptions with improved semantic search optimization.
 * Uses the updated prompt that includes themes, tropes, and character archetypes.
 */

const BATCH_SIZE = 10; // Smaller batches for LLM calls (each is a separate API call)
const DELAY_MS = 1000; // 1 second delay between batches to avoid rate limits

interface ItemToUpdate {
    id: string;
    title: string;
    category_type: string;
    description: string | null;
}

const SYSTEM_PROMPT = `You are an expert curator and critic optimizing descriptions for semantic search and discovery.

DESCRIPTION FORMAT (150-250 words total):
Write a single, cohesive description that naturally integrates the following elements without using section headers:

1. The Premise: Core plot/concept and what makes it unique.
2. Themes & Tropes: Mention relevant themes (e.g., "coming of age", "revenge") and tropes (e.g., "found family", "time loop") naturally within the text.
3. Tone & Appeal: Mood keywords and who would enjoy it.

FOOTER (on new line after double newline):
Year: YYYY | Creator: [Name] | Notable Awards: [Awards or "None"]

CRITICAL: Include searchable keywords. Return ONLY the description text. Do NOT use headers like "PREMISE:" or "THEMES:".`;

// Refusal patterns - detect when LLM refuses to generate
const REFUSAL_PATTERNS = [
    "I can't generate", "I cannot generate", "I am unable to",
    "I'm not able to", "I apologize, but", "I can't help with",
    "sexually explicit", "adult content", "harmful content",
    "violates my safety", "I cannot fulfill", "As an AI",
    "happy to help with those instead", "If you have other"
];

function isRefusal(text: string): boolean {
    const lower = text.toLowerCase();
    return REFUSAL_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

async function generateDescription(
    title: string,
    type: string,
    apiKey: string,
    provider: string,
    model?: string,
    openrouterKey?: string
): Promise<string | null> {
    const userPrompt = `Generate a description for:
Title: ${title}
Type: ${type}`;

    try {
        // Attempt 1: Primary model
        let response = await callLLM({
            userPrompt,
            systemPrompt: SYSTEM_PROMPT,
            apiKey,
            provider,
            model,
            timeoutMs: 60000
        });

        let description = response.trim();

        // Handle JSON-wrapped responses
        if (description.startsWith('{') || description.startsWith('"')) {
            try {
                const parsed = JSON.parse(description);
                description = typeof parsed === 'string' ? parsed : parsed.description || description;
            } catch { }
        }

        // Check for refusal - if so, try Grok fallback
        if (isRefusal(description) && openrouterKey) {
            console.log(`⚡ Primary model refused "${title}". Trying Grok fallback...`);

            try {
                response = await callLLM({
                    userPrompt,
                    systemPrompt: SYSTEM_PROMPT,
                    apiKey: openrouterKey,
                    provider: 'openrouter',
                    model: 'x-ai/grok-4.1-fast',
                    timeoutMs: 60000
                });

                description = response.trim();

                // If Grok also refused, use placeholder
                if (isRefusal(description)) {
                    console.log(`⚠️ Grok also refused "${title}". Using placeholder.`);
                    description = `${title} - A ${type.toLowerCase()} title. No detailed description available.`;
                }
            } catch (grokError) {
                console.log(`⚠️ Grok fallback failed for "${title}". Using placeholder.`);
                description = `${title} - A ${type.toLowerCase()} title. No detailed description available.`;
            }
        }

        return description;
    } catch (error) {
        console.error(`❌ LLM Error for "${title}":`, error);
        return null;
    }
}

async function backfillDescriptions() {
    const supabase = createServiceRoleClient();

    console.log("🔧 Fetching LLM configuration from database...");

    // Read LLM config directly from system_settings table (bypasses Next.js)
    const { data: settings, error: settingsError } = await (supabase
        .from('system_settings') as any)
        .select('key, value')
        .in('key', ['llm_provider', 'llm_model', 'llm_api_key']);

    if (settingsError) {
        console.error("❌ Error fetching settings:", settingsError);
        process.exit(1);
    }

    // Decrypt and extract values
    const config: Record<string, string> = {};
    for (const s of settings || []) {
        config[s.key] = decrypt(s.value);
    }

    const provider = config['llm_provider'] || 'openrouter';
    const model = config['llm_model'] || undefined;
    const apiKey = config['llm_api_key'];  // The main LLM API key
    const openrouterKey = apiKey;  // For Grok fallback, use same key

    if (!apiKey) {
        console.error("❌ No LLM API key found in database!");
        console.error("   Make sure you have configured an API key in Admin -> Settings");
        process.exit(1);
    }

    console.log(`✅ Using provider: ${provider}, model: ${model || 'default'}`);

    console.log("🔍 Fetching all items (paginated)...");

    // Fetch ALL items using pagination (Supabase defaults to 1000 limit)
    const PAGE_SIZE = 1000;
    let allItems: ItemToUpdate[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data: items, error: fetchError } = await supabase
            .from('global_items')
            .select('id, title, category_type, description')
            .order('created_at', { ascending: true })
            .range(from, to);

        if (fetchError) {
            console.error("❌ Error fetching items:", fetchError);
            return;
        }

        if (!items || items.length === 0) {
            hasMore = false;
        } else {
            allItems = allItems.concat(items as unknown as ItemToUpdate[]);
            console.log(`   Fetched ${allItems.length} items so far...`);
            hasMore = items.length === PAGE_SIZE;
            page++;
        }
    }

    if (allItems.length === 0) {
        console.log("✅ No items found.");
        return;
    }

    console.log(`🚀 Found ${allItems.length} items to process in batches of ${BATCH_SIZE}.`);
    console.log(`⏱️  Estimated time: ${Math.ceil(allItems.length / BATCH_SIZE * (DELAY_MS / 1000 + 5) / 60)} minutes`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const totalBatches = Math.ceil(allItems.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, allItems.length);
        const batch = allItems.slice(start, end);

        console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (items ${start + 1}-${end})...`);

        for (const item of batch) {
            // Skip items that already have decent length descriptions (likely already valid)
            const MIN_DESCRIPTION_LENGTH = 750;
            if (item.description && item.description.length >= MIN_DESCRIPTION_LENGTH) {
                skippedCount++;
                continue;
            }

            // Generate new description with Grok fallback support
            const newDescription = await generateDescription(
                item.title,
                item.category_type.toLowerCase().replace(/_/g, ' '),
                apiKey,
                provider,
                model || undefined,
                openrouterKey || undefined  // For Grok fallback
            );

            if (!newDescription) {
                console.error(`❌ Failed to generate for: ${item.title}`);
                failCount++;
                continue;
            }

            // Check if description is too short (likely a refusal)
            if (newDescription.length < 100) {
                console.warn(`⚠️ Short description for "${item.title}" (${newDescription.length} chars) - skipping`);
                skippedCount++;
                continue;
            }

            // Update the item
            const { error: updateError } = await (supabase
                .from('global_items') as any)
                .update({ description: newDescription })
                .eq('id', item.id);

            if (updateError) {
                console.error(`❌ Error updating ${item.id}:`, updateError);
                failCount++;
            } else {
                successCount++;
                console.log(`✅ ${item.title} (${newDescription.length} chars)`);
            }
        }

        console.log(`📊 Batch ${batchIndex + 1} complete. Total: ${successCount} success, ${failCount} fail, ${skippedCount} skipped`);

        // Delay between batches
        if (batchIndex < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    console.log("\n--- Description Backfill Result ---");
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️ Skipped (short): ${skippedCount}`);
    console.log("-----------------------------------");
    console.log("\n🔜 Next step: Run backfill-embeddings.ts to regenerate embeddings");
}

backfillDescriptions().catch(err => {
    console.error("💥 Unhandled Error:", err);
});
