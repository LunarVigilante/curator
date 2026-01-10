import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
    // Count total tags
    const { count } = await supabase
        .from('tags')
        .select('*', { count: 'exact', head: true })

    console.log('Total tags in database:', count)

    // Check for Action tag by name
    const { data: actionTag } = await supabase
        .from('tags')
        .select('id, name')
        .eq('name', 'Action')
        .single()

    console.log('Action tag:', actionTag)

    // Check by specific ID
    const { data: byId } = await supabase
        .from('tags')
        .select('id, name')
        .eq('id', '012e481e-1936-49ff-88f8-f0d251dcbeb2')
        .single()

    console.log('By ID 012e481e...:', byId)
}

main()
