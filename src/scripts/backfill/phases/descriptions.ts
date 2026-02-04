/**
 * Descriptions Phase - Generates 4-part structured descriptions using AI
 * 
 * For TV shows: Uses specialized Semantic Weaving prompts with scripted/unscripted detection
 * For other types: Uses standard structured description prompts
 */

import { generateStructuredDescription, combineDescription } from '@/lib/ai/structured-description';
import { generateTvShowDescription } from '@/lib/ai/tv-show-description';
import { aiLimiter, sleep } from '@/lib/harvesters/shared';
import { CLIOptions, PhaseStats, createStats, DELAY_BETWEEN_ITEMS } from '../config';

export async function runDescriptionsPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
    const stats = createStats();

    console.log('\n' + '─'.repeat(70));
    console.log('📝 PHASE: AI DESCRIPTIONS');
    console.log('─'.repeat(70));

    // Select more fields for TV shows to enable grounding
    const selectFields = options.category === 'TV_SHOW' || options.category === 'TV'
        ? 'id, title, description, category_type, metadata, genres, keywords, cast'
        : 'id, title, description, category_type, metadata';

    // Query for items needing descriptions
    let query = (supabase.from('global_items') as any)
        .select(selectFields)
        .eq('category_type', options.category)
        .order('created_at', { ascending: false });

    if (!options.force) {
        query = query.is('description_parts', null);
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
                console.log(`      ⏭️  DRY RUN - Would generate description`);
                stats.skipped++;
                continue;
            }

            let description_parts;

            // Use TV-specific prompts for TV shows
            if (item.category_type === 'TV_SHOW' || item.category_type === 'TV') {
                description_parts = await aiLimiter(() =>
                    generateTvShowDescription(supabase, {
                        title: item.title,
                        originalDescription: item.description || '',
                        type: 'TV Show',
                        metadata: item.metadata,
                        // Enhanced grounding data
                        genres: item.genres || [],
                        keywords: item.keywords || item.metadata?.keywords || [],
                        castWithCharacters: item.metadata?.cast_with_characters || [],
                        contentDescriptors: item.metadata?.content_descriptors || [],
                        networks: item.metadata?.networks || []
                    })
                );
            } else {
                // Use standard prompts for other types
                description_parts = await aiLimiter(() =>
                    generateStructuredDescription(supabase, {
                        title: item.title,
                        originalDescription: item.description || '',
                        type: item.category_type,
                        metadata: item.metadata
                    })
                );
            }

            if (description_parts.premise || description_parts.themes) {
                const description = combineDescription(description_parts);

                await (supabase.from('global_items') as any)
                    .update({
                        description,
                        description_parts,
                        last_metadata_update: new Date().toISOString()
                    })
                    .eq('id', item.id);

                console.log(`      ✅ Generated ${description.length} char description`);
                stats.updated++;
            } else {
                console.log(`      ⏭️  Failed to generate description`);
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

