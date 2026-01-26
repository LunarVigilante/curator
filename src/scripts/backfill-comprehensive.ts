/**
 * Comprehensive Metadata Backfill Script
 * 
 * REFACTORED to use shared enrichment services for consistency with API endpoints.
 * 
 * This script processes items in phases to fill in missing metadata:
 * 1. Metadata - Fetches from TMDB/OMDB/etc (uses MetadataService)
 * 2. Descriptions - Generates 4-part structured descriptions (uses AIEnrichmentService)
 * 3. Tags - Generates AI tags
 * 4. Embeddings - Rebuilds embeddings using enriched metadata
 * 5. Full - Runs all phases at once using the unified pipeline
 * 
 * Usage:
 *   npx tsx src/scripts/backfill-comprehensive.ts --category=MOVIE
 *   npx tsx src/scripts/backfill-comprehensive.ts --category=TV_SHOW --limit=100
 *   npx tsx src/scripts/backfill-comprehensive.ts --category=ANIME --phase=metadata
 *   npx tsx src/scripts/backfill-comprehensive.ts --category=MOVIE --phase=full
 *   npx tsx src/scripts/backfill-comprehensive.ts --category=MOVIE --dry-run
 * 
 * Options:
 *   --category=<TYPE>  Required. Category to process (MOVIE, TV_SHOW, ANIME, VIDEO_GAME, etc.)
 *   --limit=<N>        Optional. Process only N items per phase
 *   --phase=<PHASE>    Optional. Run specific phase: metadata, descriptions, tags, embeddings, full, all
 *   --dry-run          Optional. Preview changes without saving
 *   --force            Optional. Force regeneration even if data exists
 */

import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
    refreshMetadata,
    enrichItem,
    fullEnrichment,
    type EnrichmentResult
} from '@/lib/services/enrichment';
import { buildEmbeddingText } from '@/lib/ai/structured-description';
import { generateEmbedding, generateTags, ensureTags, aiLimiter, sleep } from '@/lib/harvesters/shared';
import { generateStructuredDescription, combineDescription } from '@/lib/ai/structured-description';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BATCH_SIZE = 50;
const DELAY_BETWEEN_ITEMS = 100; // ms

const VALID_CATEGORIES = [
    'ANIME', 'MOVIE', 'TV_SHOW', 'VIDEO_GAME', 'BOARD_GAME', 'BOOK',
    'MANGA', 'LIGHT_NOVEL', 'MUSIC_ARTIST', 'MUSIC_ALBUM', 'MUSIC_TRACK', 'PODCAST', 'COMICS'
];

type Phase = 'metadata' | 'descriptions' | 'tags' | 'embeddings' | 'full' | 'all';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface CLIOptions {
    category: string;
    limit?: number;
    phase: Phase;
    dryRun: boolean;
    force: boolean;
}

function parseArgs(): CLIOptions {
    const args = process.argv.slice(2);

    const categoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1]?.toUpperCase();
    const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
    const phaseArg = args.find(a => a.startsWith('--phase='))?.split('=')[1]?.toLowerCase() as Phase;
    const dryRun = args.includes('--dry-run');
    const force = args.includes('--force');

    if (!categoryArg) {
        console.error('\n❌ ERROR: --category flag is required');
        console.error('   Usage: npx tsx src/scripts/backfill-comprehensive.ts --category=MOVIE\n');
        console.error('   Valid categories:', VALID_CATEGORIES.join(', '));
        process.exit(1);
    }

    if (!VALID_CATEGORIES.includes(categoryArg)) {
        console.error(`\n❌ ERROR: Invalid category "${categoryArg}"`);
        console.error('   Valid categories:', VALID_CATEGORIES.join(', '));
        process.exit(1);
    }

    const validPhases: Phase[] = ['metadata', 'descriptions', 'tags', 'embeddings', 'full', 'all'];
    const phase = phaseArg && validPhases.includes(phaseArg) ? phaseArg : 'all';

    return {
        category: categoryArg,
        limit: limitArg ? parseInt(limitArg, 10) : undefined,
        phase,
        dryRun,
        force
    };
}

// ============================================================================
// PHASE STATS
// ============================================================================

interface PhaseStats {
    processed: number;
    updated: number;
    skipped: number;
    failed: number;
}

function createStats(): PhaseStats {
    return { processed: 0, updated: 0, skipped: 0, failed: 0 };
}

// ============================================================================
// PHASE 1: METADATA (Using shared MetadataService)
// ============================================================================

async function runMetadataPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
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

// ============================================================================
// PHASE 2: DESCRIPTIONS (Using shared AIEnrichmentService)
// ============================================================================

async function runDescriptionsPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
    const stats = createStats();

    console.log('\n' + '─'.repeat(70));
    console.log('📝 PHASE: AI DESCRIPTIONS (Using AIEnrichmentService)');
    console.log('─'.repeat(70));

    // Query for items needing descriptions
    let query = (supabase.from('global_items') as any)
        .select('id, title, description, category_type, metadata')
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

            // Generate 4-part structured description
            const description_parts = await aiLimiter(() =>
                generateStructuredDescription(supabase, {
                    title: item.title,
                    originalDescription: item.description || '',
                    type: item.category_type,
                    metadata: item.metadata
                })
            );

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

// ============================================================================
// PHASE 3: TAGS (Using shared tag generation)
// ============================================================================

async function runTagsPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
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

// ============================================================================
// PHASE 4: EMBEDDINGS
// ============================================================================

async function runEmbeddingsPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
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

// ============================================================================
// PHASE: FULL (Everything at once using unified pipeline)
// ============================================================================

async function runFullPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
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

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const options = parseArgs();
    const supabase = createServiceRoleClient();

    console.log('\n' + '═'.repeat(70));
    console.log('🚀 COMPREHENSIVE METADATA BACKFILL (Using Shared Services)');
    console.log('═'.repeat(70));
    console.log(`📂 Category: ${options.category}`);
    console.log(`📦 Phase: ${options.phase}`);
    if (options.limit) console.log(`📊 Limit: ${options.limit} items per phase`);
    if (options.dryRun) console.log(`🔍 DRY RUN MODE: No changes will be saved`);
    if (options.force) console.log(`⚡ FORCE MODE: Regenerating even if data exists`);
    console.log('═'.repeat(70));

    const totals: Record<string, PhaseStats> = {
        metadata: createStats(),
        descriptions: createStats(),
        tags: createStats(),
        embeddings: createStats(),
        full: createStats()
    };

    // Run phases based on selection
    if (options.phase === 'full') {
        // Full enrichment runs everything together
        totals.full = await runFullPhase(supabase, options);
    } else {
        // Individual phases
        if (options.phase === 'all' || options.phase === 'metadata') {
            totals.metadata = await runMetadataPhase(supabase, options);
        }

        if (options.phase === 'all' || options.phase === 'descriptions') {
            totals.descriptions = await runDescriptionsPhase(supabase, options);
        }

        if (options.phase === 'all' || options.phase === 'tags') {
            totals.tags = await runTagsPhase(supabase, options);
        }

        if (options.phase === 'all' || options.phase === 'embeddings') {
            totals.embeddings = await runEmbeddingsPhase(supabase, options);
        }
    }

    // Final summary
    console.log('\n' + '═'.repeat(70));
    console.log('✅ BACKFILL COMPLETE');
    console.log('═'.repeat(70));

    if (options.phase === 'full') {
        console.log(`🚀 Full:         ${totals.full.updated} updated, ${totals.full.skipped} skipped, ${totals.full.failed} failed`);
    } else {
        console.log(`📡 Metadata:     ${totals.metadata.updated} updated, ${totals.metadata.skipped} skipped, ${totals.metadata.failed} failed`);
        console.log(`📝 Descriptions: ${totals.descriptions.updated} updated, ${totals.descriptions.skipped} skipped, ${totals.descriptions.failed} failed`);
        console.log(`🏷️  Tags:         ${totals.tags.updated} updated, ${totals.tags.skipped} skipped, ${totals.tags.failed} failed`);
        console.log(`🧮 Embeddings:   ${totals.embeddings.updated} updated, ${totals.embeddings.skipped} skipped, ${totals.embeddings.failed} failed`);
    }

    console.log('═'.repeat(70) + '\n');
}

main().catch(console.error);
