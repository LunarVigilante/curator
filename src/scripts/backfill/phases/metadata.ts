/**
 * Metadata Phase - Fetches metadata from external APIs (TMDB, OMDB, etc.)
 */

import { refreshMetadata } from '@/lib/services/enrichment';
import { buildEmbeddingText } from '@/lib/ai/structured-description';
import { generateEmbedding, sleep } from '@/lib/harvesters/shared';
import { CLIOptions, PhaseStats, createStats, DELAY_BETWEEN_ITEMS } from '../config';

export async function runMetadataPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
    const stats = createStats();

    console.log('\n' + '─'.repeat(70));
    console.log('📡 PHASE: METADATA REFRESH (Using MetadataService)');
    console.log('─'.repeat(70));

    // Query for items - all items in category (force will overwrite, non-force fills gaps)
    const { data: items, error } = await (supabase.from('global_items') as any)
        .select('id, title, category_type')
        .eq('category_type', options.category)
        .order('created_at', { ascending: false })
        .limit(options.limit || 1000);

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
                console.log(`      ⏭️  DRY RUN - Would refresh metadata`);
                stats.skipped++;
                continue;
            }

            const result = await refreshMetadata(supabase, item.id, { force: options.force });

            if (result.success && result.fieldsUpdated.length > 0) {
                // Update the item
                await (supabase.from('global_items') as any)
                    .update(result.enrichedData)
                    .eq('id', item.id);

                // Also regenerate embedding with new metadata
                const { data: updatedItem } = await (supabase.from('global_items') as any)
                    .select('*')
                    .eq('id', item.id)
                    .single();

                if (updatedItem) {
                    const embeddingText = buildEmbeddingText(updatedItem);
                    const embedding = await generateEmbedding(embeddingText);
                    if (embedding) {
                        await (supabase.from('global_items') as any)
                            .update({ embedding })
                            .eq('id', item.id);
                    }
                }

                console.log(`      ✅ Updated ${result.fieldsUpdated.length} fields + embedding`);
                stats.updated++;
            } else {
                console.log(`      ⏭️  No new metadata found`);
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
