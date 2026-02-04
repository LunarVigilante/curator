/**
 * Embeddings Phase - Regenerates vector embeddings
 */

import { buildEmbeddingText } from '@/lib/ai/structured-description';
import { generateEmbedding, sleep } from '@/lib/harvesters/shared';
import { CLIOptions, PhaseStats, createStats, DELAY_BETWEEN_ITEMS } from '../config';

export async function runEmbeddingsPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
    const stats = createStats();

    console.log('\n' + '─'.repeat(70));
    console.log('🧮 PHASE: EMBEDDING REGENERATION');
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

    console.log(`📊 Found ${items?.length || 0} items to process\n`);
    if (!items || items.length === 0) return stats;

    for (const item of items) {
        stats.processed++;

        try {
            console.log(`   [${stats.processed}/${items.length}] ${item.title}`);

            if (options.dryRun) {
                console.log(`      ⏭️  DRY RUN - Would generate embedding`);
                stats.skipped++;
                continue;
            }

            const embeddingText = buildEmbeddingText(item);
            const embedding = await generateEmbedding(embeddingText);

            if (embedding) {
                await (supabase.from('global_items') as any)
                    .update({ embedding })
                    .eq('id', item.id);

                console.log(`      ✅ Generated embedding (${embedding.length} dims)`);
                stats.updated++;
            } else {
                console.log(`      ⏭️  Failed to generate embedding`);
                stats.skipped++;
            }

        } catch (error: any) {
            console.log(`      ❌ Error: ${error.message}`);
            stats.failed++;
        }

        await sleep(DELAY_BETWEEN_ITEMS);
    }

    return stats;
}
