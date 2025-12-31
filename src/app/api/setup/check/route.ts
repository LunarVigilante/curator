import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await createClient()

        // Try using an RPC function first (if it exists)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_profile_count')

        if (!rpcError && rpcData !== null) {
            const setupRequired = rpcData === 0
            return NextResponse.json({ setupRequired })
        }

        // Fallback: count profiles (may return 0 if RLS blocks)
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })

        // If we get an error or null count, check auth.users as a backup
        if (error || count === null) {
            // If profiles query fails, assume setup is done (to avoid loop)
            return NextResponse.json({ setupRequired: false })
        }

        const setupRequired = count === 0

        return NextResponse.json({ setupRequired })
    } catch {
        // On any error, assume setup is not required to avoid blocking users
        return NextResponse.json({ setupRequired: false })
    }
}
