#!/usr/bin/env npx tsx
/**
 * Backfill Tags Table
 * 
 * Extracts unique tags from cached_tags across all global_items
 * and populates the tags table with AI-generated descriptions.
 * 
 * Usage:
 *   npx tsx src/scripts/backfill-tags.ts           # Run full backfill
 *   npx tsx src/scripts/backfill-tags.ts --dry-run # Preview without saving
 *   npx tsx src/scripts/backfill-tags.ts --limit=100 # Limit to 100 tags
 */

import 'dotenv/config'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateTagDescription, categorizeTag } from '@/lib/ai/tag-description'

// CLI Args
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
const LIMIT = limitArg ? parseInt(limitArg, 10) : null

const supabase = createServiceRoleClient()

// Helper to generate slug from name
const toSlug = (name: string) =>
    name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

async function main() {
    console.log('🏷️  Tag Backfill Script')
    console.log('========================')
    if (DRY_RUN) console.log('🔍 DRY RUN MODE - No changes will be made\n')

    // 1. Extract all unique tags from cached_tags across all items
    console.log('📊 Fetching all cached_tags from global_items...')

    const { data: items, error: fetchError } = await supabase
        .from('global_items')
        .select('cached_tags')
        .not('cached_tags', 'is', null)

    if (fetchError) {
        console.error('❌ Failed to fetch items:', fetchError)
        process.exit(1)
    }

    // Extract unique tag names
    const tagSet = new Set<string>()
    for (const item of items || []) {
        const tags = item.cached_tags as Array<{ id: string; name: string }> | null
        if (tags) {
            for (const tag of tags) {
                if (tag.name?.trim()) {
                    tagSet.add(tag.name.trim())
                }
            }
        }
    }

    const uniqueTagNames = Array.from(tagSet).sort()
    console.log(`   Found ${uniqueTagNames.length} unique tags across ${items?.length || 0} items\n`)

    // 2. Check which tags already exist in tags table
    console.log('🔍 Checking existing tags in tags table...')

    const slugs = uniqueTagNames.map(toSlug)
    const { data: existingTags } = await supabase
        .from('tags')
        .select('slug')
        .in('slug', slugs)

    const existingSlugs = new Set((existingTags || []).map(t => t.slug))
    const tagsToCreate = uniqueTagNames.filter(name => !existingSlugs.has(toSlug(name)))

    console.log(`   ${existingTags?.length || 0} tags already exist`)
    console.log(`   ${tagsToCreate.length} tags need to be created\n`)

    if (tagsToCreate.length === 0) {
        console.log('✅ All tags already exist in tags table!')
        process.exit(0)
    }

    // Apply limit if specified
    const tagsToProcess = LIMIT ? tagsToCreate.slice(0, LIMIT) : tagsToCreate
    if (LIMIT) {
        console.log(`⚠️  Limited to processing ${LIMIT} tags\n`)
    }

    // 3. Create missing tags with AI descriptions
    console.log('🤖 Generating AI descriptions for new tags...\n')

    let created = 0
    let failed = 0

    for (let i = 0; i < tagsToProcess.length; i++) {
        const name = tagsToProcess[i]
        const progress = `[${i + 1}/${tagsToProcess.length}]`

        try {
            // Generate description and category
            const [description, category] = await Promise.all([
                generateTagDescription(name),
                categorizeTag(name)
            ])

            if (DRY_RUN) {
                console.log(`${progress} ${name}`)
                console.log(`   📝 ${description?.substring(0, 80)}...`)
                console.log(`   🏷️  Category: ${category}`)
            } else {
                // Insert into tags table
                const { error } = await supabase
                    .from('tags')
                    .insert({
                        name,
                        slug: toSlug(name),
                        description,
                        category,
                        source_type: 'ai'
                    })

                if (error) {
                    if (error.code === '23505') {
                        console.log(`${progress} ⏭️  ${name} (already exists)`)
                    } else {
                        console.error(`${progress} ❌ ${name}: ${error.message}`)
                        failed++
                    }
                } else {
                    console.log(`${progress} ✅ ${name}`)
                    created++
                }
            }

            // Rate limiting delay
            await new Promise(r => setTimeout(r, 100))
        } catch (error) {
            console.error(`${progress} ❌ ${name}: ${error}`)
            failed++
        }
    }

    // 4. Summary
    console.log('\n========================')
    console.log('📊 Summary:')
    console.log(`   Total unique tags: ${uniqueTagNames.length}`)
    console.log(`   Already existed: ${existingTags?.length || 0}`)
    if (DRY_RUN) {
        console.log(`   Would create: ${tagsToProcess.length}`)
    } else {
        console.log(`   Created: ${created}`)
        console.log(`   Failed: ${failed}`)
    }
    console.log('========================')
}

main().catch(console.error)
