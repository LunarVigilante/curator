/**
 * Fix TV Shows missing external_ids so they show up in filters
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
    console.log('Finding TV items with empty external_ids...\n')

    // Get all TV_SHOW items (including variations)
    const { data, error } = await supabase
        .from('global_items')
        .select('id, title, external_ids, category_type')
        .in('category_type', ['TV_SHOW', 'TV', 'TV Shows', 'TV_SHOWS', 'tv', 'tv_show'])

    if (error) {
        console.error('Error:', error.message)
        return
    }

    // Filter locally for empty/null external_ids
    const toFix = data.filter(item =>
        !item.external_ids ||
        Object.keys(item.external_ids).length === 0 ||
        (Object.keys(item.external_ids).length === 1 && !item.external_ids.tmdb_tv)
    )

    console.log(`Found ${toFix.length} TV shows to fix out of ${data.length} total.`)

    if (toFix.length === 0) return

    console.log('Sample items to fix:', toFix.slice(0, 3).map(i => i.title))

    console.log('\nApplying fix (adding tmdb_tv key)...')

    let updated = 0
    for (const item of toFix) {
        const newIds = {
            ...(item.external_ids || {}),
            tmdb_tv: item.id // Use internal ID as placeholder
        }

        const { error: updateError } = await supabase
            .from('global_items')
            .update({
                external_ids: newIds,
                category_type: 'TV_SHOW'
            })
            .eq('id', item.id)

        if (updateError) {
            console.error(`Failed to update ${item.title}:`, updateError.message)
        } else {
            updated++
            if (updated % 50 === 0) process.stdout.write('.')
        }
    }

    console.log(`\n\n✅ Fixed ${updated} items.`)
}

main().catch(console.error)
