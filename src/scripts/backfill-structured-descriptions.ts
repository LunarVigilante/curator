/**
 * Backfill Structured Descriptions
 * 
 * This script regenerates descriptions for all items using the new 4-part
 * structured description system, and generates new embeddings using all metadata.
 * 
 * NOW USES SHARED ENRICHMENT SERVICES for consistency with API endpoints.
 * 
 * IMPORTANT: Use --category flag to run one category at a time.
 * You can run multiple instances in parallel, one per category.
 * 
 * Usage:
 *   npx tsx src/scripts/backfill-structured-descriptions.ts --category=ANIME
 *   npx tsx src/scripts/backfill-structured-descriptions.ts --category=MOVIE --limit=100
 * 
 * Categories: ANIME, MOVIE, TV_SHOW, VIDEO_GAME, BOARD_GAME, BOOKS, MANGA, LIGHT_NOVEL, 
 *             MUSIC_ARTIST, ALBUM, MUSIC_TRACK, PODCAST, COMICS
 */

import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { regenerateItemContent } from '@/lib/services/enrichment';
import { sleep, aiLimiter } from '@/lib/harvesters/shared';

const BATCH_SIZE = 50;
const DELAY_BETWEEN_ITEMS = 100; // ms

const VALID_CATEGORIES = [
    'ANIME', 'MOVIE', 'TV_SHOW', 'VIDEO_GAME', 'BOARD_GAME', 'BOOKS',
    'MANGA', 'LIGHT_NOVEL', 'MUSIC_ARTIST', 'ALBUM', 'MUSIC_TRACK', 'PODCAST', 'COMICS'
];

async function main() {
    const args = process.argv.slice(2);
    const categoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1]?.toUpperCase();
    const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
    const limit = limitArg ? parseInt(limitArg, 10) : undefined;

    // Category is REQUIRED for parallel execution safety
    if (!categoryArg) {
        console.error('\n❌ ERROR: --category flag is required');
        console.error('   This allows running multiple backfills in parallel.\n');
        console.error('   Usage: npx tsx src/scripts/backfill-structured-descriptions.ts --category=ANIME\n');
        console.error('   Valid categories:', VALID_CATEGORIES.join(', '));
        process.exit(1);
    }

    if (!VALID_CATEGORIES.includes(categoryArg)) {
        console.error(`\n❌ ERROR: Invalid category "${categoryArg}"`);
        console.error('   Valid categories:', VALID_CATEGORIES.join(', '));
        process.exit(1);
    }

    const supabase = createServiceRoleClient();

    console.log('\n🔄 BACKFILL STRUCTURED DESCRIPTIONS (Using Shared Services)');
    console.log('============================================================');
    console.log(`📂 Category: ${categoryArg}`);
    if (limit) console.log(`📊 Limit: ${limit} items`);
    console.log('');

    // Count items needing backfill (no description_parts)
    const { count: totalCount } = await (supabase.from('global_items') as any)
        .select('id', { count: 'exact', head: true })
        .eq('category_type', categoryArg)
        .is('description_parts', null)
        .not('description', 'is', null);

    console.log(`📊 Found ${totalCount} ${categoryArg} items needing backfill\n`);

    if (!totalCount || totalCount === 0) {
        console.log(`✅ All ${categoryArg} items already have structured descriptions!`);
        return;
    }

    let processed = 0;
    let success = 0;
    let failed = 0;
    let offset = 0;

    const targetCount = limit || totalCount;

    while (processed < targetCount) {
        // Fetch batch
        const { data: items, error } = await (supabase.from('global_items') as any)
            .select('id, title, category_type')
            .eq('category_type', categoryArg)
            .is('description_parts', null)
            .not('description', 'is', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
            console.error('❌ Fetch error:', error);
            break;
        }

        if (!items || items.length === 0) {
            console.log('📭 No more items to process');
            break;
        }

        console.log(`\n📦 [${categoryArg}] Processing batch: ${processed + 1} to ${processed + items.length}`);

        for (const item of items) {
            if (limit && processed >= limit) break;

            try {
                console.log(`\n   ╔════════════════════════════════════════════════════════════════`);
                console.log(`   ║ 📽️  PROCESSING: ${item.title}`);
                console.log(`   ╠════════════════════════════════════════════════════════════════`);
                console.log(`   ║ ID: ${item.id}`);
                console.log(`   ║ Category: ${item.category_type}`);
                console.log(`   ╟────────────────────────────────────────────────────────────────`);

                // Use shared enrichment service for AI content generation
                console.log(`   ║ 🧠 Generating AI content (description + tags + embedding)...`);
                const startTime = Date.now();

                const result = await aiLimiter(() =>
                    regenerateItemContent(supabase, item.id)
                );

                const totalTime = Date.now() - startTime;

                if (result.success) {
                    console.log(`   ║ ✅ Enrichment completed in ${totalTime}ms`);
                    console.log(`   ║    📝 Description: ${result.descriptionGenerated ? 'Generated' : 'Skipped'}`);
                    console.log(`   ║    🏷️  Tags: ${result.tagsGenerated} generated`);
                    console.log(`   ║    🧮 Embedding: ${result.embeddingGenerated ? 'Generated' : 'Skipped'}`);
                    console.log(`   ║    📊 Fields updated: ${result.fieldsUpdated.length}`);
                    success++;
                } else {
                    console.log(`   ║ ❌ FAILED: ${result.error}`);
                    failed++;
                }

                console.log(`   ╚════════════════════════════════════════════════════════════════\n`);

                processed++;
                await sleep(DELAY_BETWEEN_ITEMS);

            } catch (error) {
                console.log(`   ║ ❌ PROCESSING FAILED: ${error}`);
                console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
                failed++;
                processed++;
            }
        }

        offset += BATCH_SIZE;

        // Progress report
        const pct = Math.round((processed / targetCount) * 100);
        console.log(`\n📊 [${categoryArg}] Progress: ${processed}/${targetCount} (${pct}%) - Success: ${success}, Failed: ${failed}`);
    }

    console.log('\n============================================================');
    console.log(`✅ [${categoryArg}] BACKFILL COMPLETE`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Success: ${success}`);
    console.log(`   Failed: ${failed}`);
    console.log('============================================================\n');
}

main().catch(console.error);
