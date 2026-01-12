/**
 * Backfill Structured Descriptions
 * 
 * This script regenerates descriptions for all items using the new 4-part
 * structured description system, and generates new embeddings using all metadata.
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
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description';
import { generateEmbedding, generateTags, ensureTags, aiLimiter, sleep } from '@/lib/harvesters/shared';

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

    console.log('\n🔄 BACKFILL STRUCTURED DESCRIPTIONS');
    console.log('====================================');
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
            .select('id, title, description, category_type, genres, cast, director, studio, developers, publishers, designers, mechanics, platforms, cached_tags, metadata')
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
                console.log(`   ║ Original Description: ${(item.description || '').slice(0, 100)}...`);
                console.log(`   ╟────────────────────────────────────────────────────────────────`);

                // Generate 4-part structured description
                console.log(`   ║ 🧠 Generating 4-part structured description...`);
                const startTime = Date.now();
                const description_parts = await aiLimiter(() =>
                    generateStructuredDescription(supabase, {
                        title: item.title,
                        originalDescription: item.description,
                        type: item.category_type,
                        metadata: item.metadata
                    })
                );
                const descTime = Date.now() - startTime;

                console.log(`   ║ ✅ Description generated in ${descTime}ms`);
                console.log(`   ║    📝 Premise: ${(description_parts.premise || '').slice(0, 80)}...`);
                console.log(`   ║    📝 Themes: ${(description_parts.themes || '').slice(0, 80)}...`);
                console.log(`   ║    📝 Tone: ${(description_parts.tone || '').slice(0, 80)}...`);
                console.log(`   ║    📝 Style: ${(description_parts.style || '').slice(0, 80)}...`);

                // Combine for backwards compatibility
                const description = combineDescription(description_parts);
                console.log(`   ║ 📄 Combined description length: ${description.length} chars`);

                // Generate tags if missing
                let cachedTags = item.cached_tags;
                if (!cachedTags || cachedTags.length === 0) {
                    console.log(`   ╟────────────────────────────────────────────────────────────────`);
                    console.log(`   ║ 🏷️  Generating tags (none found)...`);
                    const tagStart = Date.now();
                    const tagNames = await aiLimiter(() =>
                        generateTags(supabase, item.title, description, item.category_type)
                    );
                    cachedTags = await ensureTags(supabase, tagNames);
                    console.log(`   ║ ✅ Generated ${tagNames.length} tags in ${Date.now() - tagStart}ms`);
                    console.log(`   ║    Tags: ${tagNames.slice(0, 8).join(', ')}`);
                } else {
                    console.log(`   ║ ✅ Tags already exist: ${cachedTags.slice(0, 5).join(', ')}...`);
                }

                // Build rich embedding text from all item data
                console.log(`   ╟────────────────────────────────────────────────────────────────`);
                console.log(`   ║ 🔗 Building embedding text from metadata...`);
                const embeddingText = buildEmbeddingText({
                    ...item,
                    description,
                    description_parts,
                    cached_tags: cachedTags
                });
                console.log(`   ║    Embedding text length: ${embeddingText.length} chars`);

                // Generate new embedding
                console.log(`   ║ 🧮 Generating embedding vector...`);
                const embedStart = Date.now();
                const embedding = await generateEmbedding(embeddingText);
                const embedTime = Date.now() - embedStart;

                if (embedding) {
                    console.log(`   ║ ✅ Embedding generated in ${embedTime}ms (${embedding.length} dimensions)`);
                } else {
                    console.log(`   ║ ⚠️  No embedding generated`);
                }

                // Update item
                console.log(`   ╟────────────────────────────────────────────────────────────────`);
                console.log(`   ║ 💾 Saving to database...`);
                const updateData: any = {
                    description,
                    description_parts,
                    cached_tags: cachedTags,
                    last_metadata_update: new Date().toISOString()
                };

                if (embedding) {
                    updateData.embedding = embedding;
                }


                const { error: updateError } = await (supabase.from('global_items') as any)
                    .update(updateData)
                    .eq('id', item.id);

                if (updateError) {
                    console.log(`   ║ ❌ UPDATE FAILED: ${updateError.message}`);
                    failed++;
                } else {
                    console.log(`   ║ ✅ SAVED SUCCESSFULLY`);
                    success++;
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

    console.log('\n====================================');
    console.log(`✅ [${categoryArg}] BACKFILL COMPLETE`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Success: ${success}`);
    console.log(`   Failed: ${failed}`);
    console.log('====================================\n');
}

main().catch(console.error);

