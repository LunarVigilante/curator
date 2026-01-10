import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Cleanup script to remove section headers from descriptions.
 * Run this after backfill-descriptions.ts completes.
 * 
 * Removes headers like:
 * - "PREMISE:" or "PREMISE"
 * - "THEMES & TROPES:" or "THEMES & TROPES"
 * - "TONE & APPEAL:" or "TONE & APPEAL"
 * - And similar variations
 */

const BATCH_SIZE = 100;

// Patterns to remove - only match at START of line or after newline
// Using ^ with multiline flag and/or \n to ensure we don't match mid-sentence
const HEADER_PATTERNS = [
    // Match at start of string or after newline, followed by optional number/period
    /(?:^|\n)\s*(?:\d+\.\s*)?PREMISE\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?THEMES?\s*(?:&|AND)?\s*TROPES?\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?TONE\s*(?:&|AND)?\s*APPEAL\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?CHARACTER\s*ARCHETYPES?\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?STORY\s*TROPES?\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?FOOTER\s*:?\s*/gim,
];

function cleanDescription(description: string): string {
    let cleaned = description;
    for (const pattern of HEADER_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }
    // Clean up any resulting double spaces or leading/trailing whitespace
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    // Clean up double newlines that might result
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned;
}

async function cleanupDescriptions() {
    const supabase = createServiceRoleClient();

    console.log("🔍 Fetching all items with descriptions...");

    // Fetch ALL items using pagination
    const PAGE_SIZE = 1000;
    let allItems: { id: string; description: string }[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data: items, error: fetchError } = await supabase
            .from('global_items')
            .select('id, description')
            .not('description', 'is', null)
            .order('created_at', { ascending: true })
            .range(from, to);

        if (fetchError) {
            console.error("❌ Error fetching items:", fetchError);
            return;
        }

        if (!items || items.length === 0) {
            hasMore = false;
        } else {
            allItems = allItems.concat(items as { id: string; description: string }[]);
            console.log(`   Fetched ${allItems.length} items so far...`);
            hasMore = items.length === PAGE_SIZE;
            page++;
        }
    }

    console.log(`🚀 Found ${allItems.length} items to check for cleanup.`);

    let cleanedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    // Process in batches
    const totalBatches = Math.ceil(allItems.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, allItems.length);
        const batch = allItems.slice(start, end);

        const updates: { id: string; description: string }[] = [];

        for (const item of batch) {
            if (!item.description) continue;

            const cleaned = cleanDescription(item.description);

            // Only update if something changed
            if (cleaned !== item.description) {
                updates.push({ id: item.id, description: cleaned });
            } else {
                unchangedCount++;
            }
        }

        // Batch update
        for (const update of updates) {
            const { error } = await (supabase
                .from('global_items') as any)
                .update({ description: update.description })
                .eq('id', update.id);

            if (error) {
                console.error(`❌ Error updating ${update.id}:`, error);
                errorCount++;
            } else {
                cleanedCount++;
            }
        }

        if ((batchIndex + 1) % 10 === 0 || batchIndex === totalBatches - 1) {
            console.log(`📊 Progress: ${batchIndex + 1}/${totalBatches} batches | ${cleanedCount} cleaned, ${unchangedCount} unchanged`);
        }
    }

    console.log("\n--- Cleanup Result ---");
    console.log(`✅ Cleaned: ${cleanedCount}`);
    console.log(`⏭️ Unchanged: ${unchangedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log("----------------------");
}

cleanupDescriptions().catch(err => {
    console.error("💥 Unhandled Error:", err);
});
