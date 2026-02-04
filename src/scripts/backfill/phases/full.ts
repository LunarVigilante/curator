/**
 * Full Phase - Runs complete enrichment using the unified pipeline
 */

import { fullEnrichment, type EnrichmentResult } from '@/lib/services/enrichment';
import { aiLimiter, sleep } from '@/lib/harvesters/shared';
import { CLIOptions, PhaseStats, createStats, DELAY_BETWEEN_ITEMS } from '../config';

export async function runFullPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
    const stats = createStats();

    console.log('\n' + '─'.repeat(70));
    console.log('🚀 PHASE: FULL ENRICHMENT (Using EnrichmentPipeline)');
    console.log('─'.repeat(70));

    // Query for all items in category
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
                console.log(`      ⏭️  DRY RUN - Would run full enrichment`);
                stats.skipped++;
                continue;
            }

            // Use the unified fullEnrichment function
            const result: EnrichmentResult = await aiLimiter(() =>
                fullEnrichment(supabase, item.id)
            );

            if (result.success) {
                console.log(`      ✅ Enriched: ${result.fieldsUpdated.length} fields updated`);
                if (result.metadataUpdated) console.log(`         📡 Metadata refreshed`);
                if (result.descriptionGenerated) console.log(`         📝 Description generated`);
                if (result.tagsGenerated > 0) console.log(`         🏷️  ${result.tagsGenerated} tags generated`);
                if (result.embeddingGenerated) console.log(`         🧮 Embedding generated`);
                stats.updated++;
            } else {
                console.log(`      ⏭️  No updates: ${result.error || 'Unknown'}`);
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
