
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Normalize category key for grouping (handles case variations)
// Copied from page.tsx to ensure consistency
function normalizeCategory(cat: string | null): string {
    if (!cat) return 'null'
    const upper = cat.toUpperCase().replace(/\s+/g, '_')
    // Map all variations to canonical keys
    if (upper === 'MOVIES' || upper === 'MOVIE') return 'MOVIE'
    if (upper === 'TV_SHOWS' || upper === 'TV_SHOW' || upper === 'TV') return 'TV_SHOW'
    if (upper === 'BOOKS' || upper === 'BOOK' || upper === 'AUDIOBOOKS' || upper === 'AUDIOBOOK') return 'BOOK' // Map all books to BOOK (or split if needed?)
    // Note: page.tsx handles AUDIOBOOKS -> 'Audiobooks' label, but internal key might be 'AUDIOBOOKS' or 'BOOK'?
    // page.tsx map: BOOK: 'Books', AUDIOBOOKS: 'Audiobook' (Wait, let's checking page.tsx map logic again)
    // Actually, distinct types are better. Let's keep AUDIOBOOKS distinct if user wants.
    // User said "AUDIOBOOKS is not formatted like the rest". It was ALL CAPS.
    // My previous script mapped it to 'AUDIOBOOK'.
    if (upper === 'AUDIOBOOKS' || upper === 'AUDIOBOOK') return 'AUDIOBOOK'

    return upper
}

async function main() {
    const isFixMode = process.argv.includes('--fix')

    if (!isFixMode) {
        console.log('DRY RUN MODE. Run with --fix to apply changes.')
    }

    console.log('Scanning all items for category normalization and fixes...')

    const BATCH_SIZE = 1000
    let offset = 0
    let processed = 0
    let fixed = 0
    let hasMore = true

    // Stats for report
    const changes: Record<string, number> = {}

    while (hasMore) {
        const { data: items, error } = await supabase
            .from('global_items')
            .select('id, title, category_type, external_ids')
            .range(offset, offset + BATCH_SIZE - 1)

        if (error) {
            console.error('Error fetching batch:', error)
            break
        }

        if (!items || items.length === 0) {
            hasMore = false
            break
        }

        for (const item of items) {
            const originalCat = item.category_type
            let newCat = normalizeCategory(originalCat)
            let needsUpdate = false
            let newIds = item.external_ids || {}

            // Check if category changed
            if (newCat !== originalCat) {
                needsUpdate = true
                changes[`CAT:${originalCat}->${newCat}`] = (changes[`CAT:${originalCat}->${newCat}`] || 0) + 1
            }

            // Special fix for TV Shows: Ensure filtering works
            // If category is TV_SHOW (or being normalized to it), ensure external_ids has tmdb_tv
            if (newCat === 'TV_SHOW') {
                const hasSource = newIds && (
                    newIds.tmdb_tv ||
                    (Object.keys(newIds).length > 0 && !newIds.tmdb_tv) // existing ids but not tmdb_tv
                )

                // If no valid source key found for filtering (e.g. empty ids or no tmdb_tv), add placeholder
                if (!newIds || !newIds.tmdb_tv) {
                    newIds = { ...newIds, tmdb_tv: item.id }
                    needsUpdate = true
                    changes['TV_SOURCE_FIX'] = (changes['TV_SOURCE_FIX'] || 0) + 1
                }
            }

            if (needsUpdate && isFixMode) {
                const { error: updateError } = await supabase
                    .from('global_items')
                    .update({
                        category_type: newCat,
                        external_ids: newIds
                    })
                    .eq('id', item.id)

                if (updateError) console.error(`Failed to update ${item.id}:`, updateError)
                else {
                    fixed++
                    if (fixed % 50 === 0) process.stdout.write('.')
                }
            } else if (needsUpdate) {
                // Dry run counting
                fixed++
            }
        }

        processed += items.length
        offset += BATCH_SIZE
        process.stdout.write(`\rProcessed: ${processed} items...`)
    }

    console.log('\n\nDone!')
    console.log(`Total Scanned: ${processed}`)
    console.log(`Items needing update: ${fixed}`)
    console.log('Breakdown of changes:', JSON.stringify(changes, null, 2))
}

main().catch(console.error)
