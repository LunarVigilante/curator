/**
 * Smart Phase - Intelligent conditional updates
 * 
 * Only updates what's actually missing:
 * - Refreshes metadata if required fields are missing
 * - Regenerates description if not all 4 parts exist
 * - Generates tags if missing
 * - Regenerates embedding only if anything was updated
 * 
 * Uses batched queries to avoid timeouts on large datasets.
 */

import { refreshMetadata } from '@/lib/services/enrichment';
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description';
import { generateTvShowDescription } from '@/lib/ai/tv-show-description';
import { generateEmbedding, generateTags, ensureTags, aiLimiter, sleep } from '@/lib/harvesters/shared';
import { CLIOptions, PhaseStats, createStats, DELAY_BETWEEN_ITEMS } from '../config';
import { hasAllDescriptionParts, getMissingMetadataFields } from '../utils';

// Batch size for fetching items (to avoid timeouts)
const QUERY_BATCH_SIZE = 100;

// Only select columns needed for evaluation (avoid embedding which is huge)
const SMART_PHASE_COLUMNS = `
    id, title, description, description_parts, category_type, metadata,
    release_year, director, cast, runtime, genres, vote_average,
    studio, developers, publishers, platforms, designers, mechanics, categories,
    status, keywords, cached_tags, search_vector
`;

export async function runSmartPhase(supabase: any, options: CLIOptions): Promise<PhaseStats> {
    const stats = createStats();

    console.log('\n' + '─'.repeat(70));
    console.log('🧠 PHASE: SMART ENRICHMENT (Conditional Updates)');
    console.log('─'.repeat(70));
    console.log('   Checks each item for:');
    console.log('   • Missing metadata fields → refreshes metadata');
    console.log('   • Incomplete description_parts → regenerates description');
    console.log('   • Missing tags → generates tags');
    console.log('   • Missing search_vector → triggers tsvector backfill');
    console.log('   • Any updates → regenerates embedding');
    console.log('─'.repeat(70));

    const maxItems = options.limit || 999999;
    let offset = 0;
    let totalProcessed = 0;
    let hasMore = true;

    // First, get total count for progress display
    const { count: totalCount } = await (supabase.from('global_items') as any)
        .select('id', { count: 'exact', head: true })
        .eq('category_type', options.category);

    console.log(`📊 Found ~${Math.min(totalCount || 0, maxItems)} items to analyze (fetching in batches of ${QUERY_BATCH_SIZE})\n`);

    while (hasMore && totalProcessed < maxItems) {
        const batchLimit = Math.min(QUERY_BATCH_SIZE, maxItems - totalProcessed);

        // Fetch batch with only needed columns
        const { data: items, error } = await (supabase.from('global_items') as any)
            .select(SMART_PHASE_COLUMNS)
            .eq('category_type', options.category)
            .order('created_at', { ascending: false })
            .range(offset, offset + batchLimit - 1);

        if (error) {
            console.error('❌ Query error:', error);
            return stats;
        }

        if (!items || items.length === 0) {
            hasMore = false;
            break;
        }

        hasMore = items.length === batchLimit;
        offset += items.length;

        for (const item of items) {
            if (totalProcessed >= maxItems) break;

            stats.processed++;
            totalProcessed++;
            let needsEmbeddingUpdate = false;
            const updates: Record<string, any> = {};

            try {
                console.log(`   [${totalProcessed}/${Math.min(totalCount || totalProcessed, maxItems)}] ${item.title}`);

                // 1. Check for missing metadata fields
                const missingFields = getMissingMetadataFields(item);
                if (missingFields.length > 0) {
                    console.log(`      📡 Missing metadata: ${missingFields.join(', ')}`);

                    if (!options.dryRun) {
                        const result = await refreshMetadata(supabase, item.id, { force: false });
                        if (result.success && result.fieldsUpdated.length > 0) {
                            Object.assign(updates, result.enrichedData);
                            needsEmbeddingUpdate = true;
                            console.log(`         ✅ Fetched ${result.fieldsUpdated.length} fields`);
                        } else {
                            console.log(`         ⏭️  No new metadata available`);
                        }
                    }
                }

                // 2. Check for incomplete description_parts
                if (!hasAllDescriptionParts(item)) {
                    const existingParts = item.description_parts ? Object.keys(item.description_parts).filter(k => item.description_parts[k]) : [];
                    console.log(`      📝 Incomplete description (has: ${existingParts.join(', ') || 'none'})`);

                    if (!options.dryRun) {
                        try {
                            let description_parts;

                            // Use TV-specific 3-bucket prompts for TV shows
                            if (item.category_type === 'TV_SHOW' || item.category_type === 'TV') {
                                description_parts = await aiLimiter(() =>
                                    generateTvShowDescription(supabase, {
                                        title: item.title,
                                        originalDescription: item.description || '',
                                        type: 'TV Show',
                                        metadata: { ...item.metadata, ...updates },
                                        // Full grounding context for 3-bucket detection
                                        genres: item.genres || [],
                                        keywords: item.keywords || item.metadata?.keywords || [],
                                        castWithCharacters: item.metadata?.cast_with_characters || [],
                                        contentDescriptors: item.metadata?.content_descriptors || [],
                                        networks: item.metadata?.networks || []
                                    })
                                );
                            } else {
                                // Standard prompts for other categories
                                description_parts = await aiLimiter(() =>
                                    generateStructuredDescription(supabase, {
                                        title: item.title,
                                        originalDescription: item.description || '',
                                        type: item.category_type,
                                        metadata: { ...item.metadata, ...updates }
                                    })
                                );
                            }

                            if (description_parts.premise && description_parts.themes) {
                                updates.description = combineDescription(description_parts);
                                updates.description_parts = description_parts;
                                needsEmbeddingUpdate = true;
                                const partCount = description_parts.semanticSummary ? '5' : '4';
                                console.log(`         ✅ Generated ${partCount}-part description`);
                            } else {
                                console.log(`         ⏭️  Failed to generate description`);
                            }
                        } catch (e: any) {
                            console.log(`         ❌ Description error: ${e.message}`);
                        }
                    }
                }

                // 3. Check for missing tags
                const hasTags = item.cached_tags && Array.isArray(item.cached_tags) && item.cached_tags.length > 0;
                if (!hasTags) {
                    console.log(`      🏷️  Missing tags`);

                    if (!options.dryRun) {
                        try {
                            const tagInput = [
                                ...(item.keywords || []),
                                ...(item.genres || [])
                            ].join(', ');

                            const aiTagNames = await aiLimiter(() =>
                                generateTags(supabase, item.title, `${updates.description || item.description || ''} Keywords: ${tagInput}`, item.category_type)
                            );

                            if (aiTagNames && aiTagNames.length > 0) {
                                const validTags = await ensureTags(supabase, aiTagNames);
                                updates.cached_tags = validTags;
                                needsEmbeddingUpdate = true;
                                console.log(`         ✅ Generated ${validTags.length} tags`);
                            } else {
                                console.log(`         ⏭️  No tags generated`);
                            }
                        } catch (e: any) {
                            console.log(`         ❌ Tag error: ${e.message}`);
                        }
                    }
                }

                // 4. Check for missing search_vector (BM25 full-text search)
                // The trigger will populate it when we update the row
                if (!item.search_vector && !options.dryRun) {
                    console.log(`      🔍 Missing search_vector - will be populated via trigger`);
                    // Set a flag to ensure we do an update (the trigger fires on title/description update)
                    // If no other updates are pending, we touch updated_at to trigger it
                    if (Object.keys(updates).length === 0) {
                        updates.updated_at = new Date().toISOString();
                    }
                    needsEmbeddingUpdate = needsEmbeddingUpdate || false; // Don't force embedding update just for search_vector
                }

                // 5. Regenerate embedding if anything was updated
                if (needsEmbeddingUpdate && !options.dryRun) {
                    // Merge updates with existing item for embedding text
                    const enrichedItem = { ...item, ...updates };

                    // Use TV-specific vector builder for TV shows (Prefix Fusion)
                    let embeddingText: string;
                    if (enrichedItem.category_type === 'TV_SHOW' || enrichedItem.category_type === 'TV') {
                        const { buildTvShowVectorText } = await import('@/lib/ai/tv-show-description');
                        embeddingText = buildTvShowVectorText({
                            title: enrichedItem.title,
                            description_parts: enrichedItem.description_parts,
                            genres: enrichedItem.genres,
                            keywords: enrichedItem.keywords || enrichedItem.cached_tags,
                            semanticSummary: enrichedItem.description_parts?.semanticSummary,
                            bucketType: enrichedItem.bucket_type,
                            genreLens: enrichedItem.genre_lens
                        });
                    } else {
                        embeddingText = buildEmbeddingText(enrichedItem);
                    }

                    const embedding = await generateEmbedding(embeddingText);

                    if (embedding) {
                        updates.embedding = embedding;
                        console.log(`      🧮 Regenerated embedding (${embedding.length} dims)`);
                    }
                }

                // 6. Apply all updates
                if (Object.keys(updates).length > 0 && !options.dryRun) {
                    updates.last_metadata_update = new Date().toISOString();

                    await (supabase.from('global_items') as any)
                        .update(updates)
                        .eq('id', item.id);

                    console.log(`      ✅ Applied ${Object.keys(updates).length} updates`);
                    stats.updated++;
                } else if (options.dryRun && (missingFields.length > 0 || !hasAllDescriptionParts(item) || !hasTags || !item.search_vector)) {
                    console.log(`      ⏭️  DRY RUN - Would update item`);
                    stats.skipped++;
                } else {
                    console.log(`      ✓ Item is complete`);
                    stats.skipped++;
                }

            } catch (error: any) {
                console.log(`      ❌ Error: ${error.message}`);
                stats.failed++;
            }

            await sleep(DELAY_BETWEEN_ITEMS);
        }
    }

    return stats;
}
