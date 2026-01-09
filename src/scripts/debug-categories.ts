
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
    const { data, error } = await supabase
        .from('global_items')
        .select('category_type')
        .limit(100000)

    if (error) {
        console.error(error)
        return
    }

    const counts: Record<string, number> = {}
    data.forEach(row => {
        const key = row.category_type || 'NULL'
        counts[key] = (counts[key] || 0) + 1
    })

    console.log('Category Counts:', JSON.stringify(counts, null, 2))
}

main()
