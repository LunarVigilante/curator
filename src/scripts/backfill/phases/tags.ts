/**
 * Tags Phase - Generates AI tags for items
 */

import { generateTags, ensureTags, aiLimiter, sleep } from '@/lib/harvesters/shared';
import { CLIOptions, PhaseStats, createStats, DELAY_BETWEEN_ITEMS } from '../config';

export async function runTagsPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
    const stats = createStats();

    console.log('\n' + '─'.repeat(70));
    console.log('🏷️  PHASE: AI TAG GENERATION');
    console.log('─'.repeat(70));

    // Query for items needing tags
    let query = (supabase.from('global_items') as any)
        .select('id, title, description, category_type, genres, keywords')
        .eq('category_type', options.category)
        .order('created_at', { ascending: false });

    if (!options.force) {
        query = query.or('cached_tags.is.null,cached_tags.eq.[]');
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
                console.log(`      ⏭️  DRY RUN - Would generate tags`);
                stats.skipped++;
                continue;
            }

            const tagInput = [
                ...(item.keywords || []),
                ...(item.genres || [])
            ].join(', ');

            const aiTagNames = await aiLimiter(() =>
                generateTags(supabase, item.title, `${item.description || ''} Keywords: ${tagInput}`, item.category_type)
            );

            if (aiTagNames && aiTagNames.length > 0) {
                const validTags = await ensureTags(supabase, aiTagNames);

                await (supabase.from('global_items') as any)
                    .update({ cached_tags: validTags })
                    .eq('id', item.id);

                console.log(`      ✅ Generated ${validTags.length} tags`);
                stats.updated++;
            } else {
                console.log(`      ⏭️  No tags generated`);
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
