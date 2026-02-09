/**
 * Tag Deduplication Script
 * 
 * Merges fragmented tags to their canonical forms using the canonical tag registry.
 * 
 * Strategy:
 * 1. Fetch all tags from the `tags` table
 * 2. Match each tag to its canonical form via fuzzy matching
 * 3. Build merge groups (variant → canonical)
 * 4. For each item, rewrite `cached_tags` JSONB to use canonical tag IDs
 * 5. Delete orphaned variant tags from the `tags` table
 * 
 * Usage:
 *   npx tsx src/scripts/deduplicate-tags.ts [--dry-run] [--limit=N]
 */

import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { matchCanonicalTag, CANONICAL_TAG_SET } from '@/lib/enrichment/canonical-tags';

const supabase = createServiceRoleClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
    const limitArg = args.find(a => a.startsWith('--limit='));
    return limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
})();

interface TagRow {
    id: string;
    name: string;
    slug: string;
    description?: string;
    category?: string;
}

interface CachedTag {
    id: string;
    name: string;
}

// Slug generation matching the existing convention
function toSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════');
    console.log('║ 🏷️  TAG DEDUPLICATION');
    console.log(`║ Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : '⚠️  LIVE — will modify database'}`);
    console.log('╚══════════════════════════════════════════════════════════════');

    // ========================================================================
    // Phase 1: Fetch all tags and build merge map
    // ========================================================================
    console.log('\n📥 Phase 1: Fetching all tags...');

    let allTags: TagRow[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;

    while (true) {
        const { data, error } = await (supabase.from('tags') as any)
            .select('id, name, slug, description, category')
            .range(offset, offset + PAGE_SIZE - 1)
            .order('id');

        if (error) {
            console.error('Failed to fetch tags:', error);
            process.exit(1);
        }

        if (!data || data.length === 0) break;
        allTags = allTags.concat(data);
        offset += data.length;

        if (data.length < PAGE_SIZE) break;
    }

    console.log(`   Found ${allTags.length} total tags`);

    // ========================================================================
    // Phase 2: Match each tag to canonical form and build merge groups
    // ========================================================================
    console.log('\n🔍 Phase 2: Building canonical merge map...');

    // Maps: canonical_name → { canonicalTag, variantTags[] }
    const mergeGroups = new Map<string, { canonical: TagRow | null; variants: TagRow[] }>();
    let alreadyCanonical = 0;
    let matched = 0;
    let unmatched = 0;

    for (const tag of allTags) {
        const normalizedName = tag.name.toLowerCase().trim();
        const canonicalName = matchCanonicalTag(normalizedName);

        if (canonicalName === null) {
            // No match — this is a genuine unique tag, keep it
            unmatched++;
            continue;
        }

        if (normalizedName === canonicalName) {
            // Exact match to canonical — this IS the canonical tag
            alreadyCanonical++;
            if (!mergeGroups.has(canonicalName)) {
                mergeGroups.set(canonicalName, { canonical: tag, variants: [] });
            } else {
                mergeGroups.get(canonicalName)!.canonical = tag;
            }
            continue;
        }

        // This tag is a variant that should be merged into its canonical form
        matched++;
        if (!mergeGroups.has(canonicalName)) {
            mergeGroups.set(canonicalName, { canonical: null, variants: [tag] });
        } else {
            mergeGroups.get(canonicalName)!.variants.push(tag);
        }
    }

    // Count groups that actually have variants to merge
    const groupsWithVariants = [...mergeGroups.values()].filter(g => g.variants.length > 0);

    console.log(`   Already canonical: ${alreadyCanonical}`);
    console.log(`   Matched to canonical: ${matched}`);
    console.log(`   Unmatched (unique): ${unmatched}`);
    console.log(`   Merge groups with variants: ${groupsWithVariants.length}`);

    // Show top 20 merge groups by variant count
    const sortedGroups = groupsWithVariants
        .sort((a, b) => b.variants.length - a.variants.length)
        .slice(0, 20);

    console.log('\n📊 Top merge groups:');
    for (const group of sortedGroups) {
        const canonName = group.canonical?.name || '[NEEDS CREATE]';
        console.log(`   ${canonName}: ${group.variants.length} variants`);
        console.log(`     e.g., ${group.variants.slice(0, 3).map(v => `"${v.name}"`).join(', ')}`);
    }

    if (groupsWithVariants.length === 0) {
        console.log('\n✅ No tag deduplication needed!');
        return;
    }

    // ========================================================================
    // Phase 3: Ensure canonical tags exist in DB
    // ========================================================================
    console.log('\n🏗️  Phase 3: Ensuring canonical tags exist...');

    let created = 0;
    for (const [canonicalName, group] of mergeGroups) {
        if (group.variants.length === 0) continue; // No variants to merge

        if (!group.canonical) {
            // Canonical tag doesn't exist in DB — create it
            const slug = toSlug(canonicalName);
            if (DRY_RUN) {
                console.log(`   Would create canonical tag: "${canonicalName}" (slug: ${slug})`);
                // Assign a placeholder for dry-run tracking
                group.canonical = { id: `dry-run-${slug}`, name: canonicalName, slug };
                created++;
            } else {
                const { data, error } = await (supabase.from('tags') as any)
                    .insert({
                        name: canonicalName,
                        slug,
                        description: group.variants[0]?.description || null,
                        category: group.variants[0]?.category || null,
                        source_type: 'canonical'
                    })
                    .select('id, name, slug, description, category')
                    .single();

                if (error) {
                    // May already exist by slug
                    if (error.code === '23505') {
                        const { data: existing } = await (supabase.from('tags') as any)
                            .select('id, name, slug, description, category')
                            .eq('slug', slug)
                            .single();
                        if (existing) {
                            group.canonical = existing;
                        }
                    } else {
                        console.error(`   Failed to create "${canonicalName}":`, error.message);
                        continue;
                    }
                } else if (data) {
                    group.canonical = data;
                    created++;
                }
            }
        }
    }

    console.log(`   Created ${created} new canonical tags`);

    // ========================================================================
    // Phase 4: Build variant ID → canonical ID mapping
    // ========================================================================
    console.log('\n🗺️  Phase 4: Building ID merge map...');

    // variantId → canonicalTag
    const idMergeMap = new Map<string, TagRow>();
    // variantName (lowercase) → canonical name
    const nameMergeMap = new Map<string, string>();

    for (const [canonicalName, group] of mergeGroups) {
        if (!group.canonical || group.variants.length === 0) continue;

        for (const variant of group.variants) {
            idMergeMap.set(variant.id, group.canonical);
            nameMergeMap.set(variant.name.toLowerCase().trim(), group.canonical.name);
        }
    }

    console.log(`   ID merge map: ${idMergeMap.size} variant IDs → canonical`);

    // ========================================================================
    // Phase 5: Update global_items.cached_tags
    // ========================================================================
    console.log('\n📝 Phase 5: Rewriting item cached_tags...');

    // Fetch items in batches
    let itemOffset = 0;
    const ITEM_PAGE_SIZE = 500;
    let itemsUpdated = 0;
    let itemsScanned = 0;
    let totalTagsReplaced = 0;

    while (true) {
        let query = (supabase.from('global_items') as any)
            .select('id, cached_tags')
            .not('cached_tags', 'is', null)
            .range(itemOffset, itemOffset + ITEM_PAGE_SIZE - 1)
            .order('id');

        const { data: items, error } = await query;

        if (error) {
            console.error('Failed to fetch items:', error);
            break;
        }

        if (!items || items.length === 0) break;

        for (const item of items) {
            const cachedTags: CachedTag[] = item.cached_tags;
            if (!Array.isArray(cachedTags) || cachedTags.length === 0) continue;

            let changed = false;
            const seen = new Set<string>();
            const newTags: CachedTag[] = [];

            for (const tag of cachedTags) {
                const mergedTo = idMergeMap.get(tag.id);
                const target = mergedTo || tag;

                // Also try name-based matching for tags not in ID map
                let finalName = target.name;
                let finalId = target.id;

                if (!mergedTo) {
                    const canonName = nameMergeMap.get(tag.name.toLowerCase().trim());
                    if (canonName) {
                        // Find canonical tag ID from merge groups
                        const group = mergeGroups.get(canonName);
                        if (group?.canonical) {
                            finalName = group.canonical.name;
                            finalId = group.canonical.id;
                            changed = true;
                        }
                    }
                } else {
                    changed = true;
                    finalName = mergedTo.name;
                    finalId = mergedTo.id;
                }

                // Dedup by ID
                if (!seen.has(finalId)) {
                    seen.add(finalId);
                    newTags.push({ id: finalId, name: finalName });
                }
            }

            if (changed) {
                totalTagsReplaced += cachedTags.length - newTags.length;

                if (DRY_RUN) {
                    itemsUpdated++;
                } else {
                    const { error: updateError } = await (supabase.from('global_items') as any)
                        .update({ cached_tags: newTags })
                        .eq('id', item.id);

                    if (updateError) {
                        console.error(`   Failed to update item ${item.id}:`, updateError.message);
                    } else {
                        itemsUpdated++;
                    }
                }
            }

            itemsScanned++;
        }

        itemOffset += items.length;

        // Progress update every 1000 items
        if (itemsScanned % 1000 === 0) {
            console.log(`   Scanned ${itemsScanned} items, updated ${itemsUpdated}...`);
        }

        if (items.length < ITEM_PAGE_SIZE) break;

        if (LIMIT && itemsScanned >= LIMIT) {
            console.log(`   Reached limit of ${LIMIT} items`);
            break;
        }
    }

    console.log(`   Scanned ${itemsScanned} items total`);
    console.log(`   Updated ${itemsUpdated} items`);
    console.log(`   Net tags removed: ${totalTagsReplaced}`);

    // ========================================================================
    // Phase 6: Delete orphaned variant tags
    // ========================================================================
    console.log('\n🗑️  Phase 6: Cleaning orphaned variant tags...');

    const variantIds = [...idMergeMap.keys()];
    let deleted = 0;

    if (variantIds.length > 0) {
        // Delete in batches of 100
        for (let i = 0; i < variantIds.length; i += 100) {
            const batch = variantIds.slice(i, i + 100);

            if (DRY_RUN) {
                deleted += batch.length;
            } else {
                const { error } = await (supabase.from('tags') as any)
                    .delete()
                    .in('id', batch);

                if (error) {
                    console.error(`   Failed to delete batch at offset ${i}:`, error.message);
                } else {
                    deleted += batch.length;
                }
            }
        }
    }

    console.log(`   Deleted ${deleted} orphaned variant tags`);

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('\n╔══════════════════════════════════════════════════════════════');
    console.log('║ 📊 DEDUPLICATION SUMMARY');
    console.log('╠══════════════════════════════════════════════════════════════');
    console.log(`║ Tags scanned:         ${allTags.length}`);
    console.log(`║ Already canonical:    ${alreadyCanonical}`);
    console.log(`║ Matched to canonical: ${matched}`);
    console.log(`║ Unmatched (kept):     ${unmatched}`);
    console.log(`║ Canonical tags created: ${created}`);
    console.log(`║ Items scanned:        ${itemsScanned}`);
    console.log(`║ Items updated:        ${itemsUpdated}`);
    console.log(`║ Variant tags deleted: ${deleted}`);
    console.log(`║ Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log('╚══════════════════════════════════════════════════════════════');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
