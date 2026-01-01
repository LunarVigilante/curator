import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET() {
    try {
        // Use service role client to bypass RLS for setup check
        const supabase = createServiceRoleClient()

        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })

        if (error) {
            console.error('Setup check query error:', error)
            return NextResponse.json({ setupRequired: false, error: error.message })
        }

        const setupRequired = (count ?? 0) === 0
        console.log('Setup check: profiles count =', count, ', setupRequired =', setupRequired)

        return NextResponse.json({ setupRequired })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Setup check error:', message)

        // If service role key is missing, skip setup (user can configure manually)
        if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
            return NextResponse.json({ setupRequired: false, error: 'Service role key not configured' })
        }
        return NextResponse.json({ setupRequired: false, error: 'Check failed' })
    }
}
