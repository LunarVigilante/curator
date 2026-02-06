/**
 * Embeddings Phase - Regenerates vector embeddings
 * 
 * v4.2: Uses batch processing (50 items per request) to reduce HTTP overhead
 */

import { buildEmbeddingText } from '@/lib/ai/structured-description';
import { sleep } from '@/lib/harvesters/shared';
import { generateEmbeddingsBatch } from '@/lib/services/search';
import { CLIOptions, PhaseStats, createStats, DELAY_BETWEEN_ITEMS } from '../config';

// Voyage API recommends batches of 50-100 for optimal performance
const BATCH_SIZE = 50;

export async function runEmbeddingsPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
    const stats = createStats();

    console.log('\n' + '─'.repeat(70));
    console.log('🧮 PHASE: EMBEDDING REGENERATION (Batch Mode)');
    console.log('─'.repeat(70));

    // Query for items needing embeddings
    let query = (supabase.from('global_items') as any)
        .select('*')
        .eq('category_type', options.category)
        .order('created_at', { ascending: false });

    if (!options.force) {
        query = query.is('embedding', null);
    }

    const { data: items, error } = await query.limit(options.limit || 1000);

    if (error) {
        console.error('❌ Query error:', error);
        return stats;
    }

    console.log(`📊 Found ${items?.length || 0} items to process`);
    console.log(`📦 Batch size: ${BATCH_SIZE} items per API call\n`);
    if (!items || items.length === 0) return stats;

    // Process in batches
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(items.length / BATCH_SIZE);

        console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} items)`);

        if (options.dryRun) {
            console.log(`   ⏭️  DRY RUN - Would generate ${batch.length} embeddings`);
            stats.skipped += batch.length;
            stats.processed += batch.length;
            continue;
        }

        // Build texts for all items in batch
        const texts = batch.map((item: any) => buildEmbeddingText(item));

        try {
            // Generate embeddings in single API call
            const embeddings = await generateEmbeddingsBatch(texts, 'document');

            // Update database for each item
            for (let j = 0; j < batch.length; j++) {
                stats.processed++;
                const item = batch[j];
                const embedding = embeddings[j];

                if (embedding) {
                    await (supabase.from('global_items') as any)
                        .update({ embedding })
                        .eq('id', item.id);

                    console.log(`   ✅ ${item.title} (${embedding.length} dims)`);
                    stats.updated++;
                } else {
                    console.log(`   ⏭️  ${item.title} - Failed`);
                    stats.skipped++;
                }
            }
        } catch (batchError) {
            // ERROR BOUNDARY (v4.3): Fall back to individual processing
            console.warn(`   ⚠️ Batch failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
            console.warn(`   🔄 Falling back to individual processing...`);

            // Import generateEmbedding for individual fallback
            const { generateEmbedding } = await import('@/lib/services/search');

            for (let j = 0; j < batch.length; j++) {
                stats.processed++;
                const item = batch[j];

                try {
                    const embedding = await generateEmbedding(texts[j], 'document');
                    if (embedding) {
                        await (supabase.from('global_items') as any)
                            .update({ embedding })
                            .eq('id', item.id);
                        console.log(`   ✅ ${item.title} (${embedding.length} dims) [individual]`);
                        stats.updated++;
                    } else {
                        console.log(`   ⏭️  ${item.title} - No embedding returned`);
                        stats.skipped++;
                    }
                } catch (itemError) {
                    console.error(`   ❌ ${item.title}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
                    stats.skipped++;
                }
            }
        }

        // Rate limit between batches (not between items)
        if (i + BATCH_SIZE < items.length) {
            await sleep(DELAY_BETWEEN_ITEMS);
        }
    }

    console.log(`\n📊 Batch processing complete: ${stats.updated} updated, ${stats.skipped} skipped`);
    return stats;
}
