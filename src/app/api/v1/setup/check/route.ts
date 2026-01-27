import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withPublicApi } from '@/lib/middleware'
import { log } from 'next-axiom'

/**
 * Setup check endpoint
 * 
 * Checks if the application needs initial setup (no profiles exist).
 * This is a PUBLIC route with anonymous rate limiting (10/min).
 */
export const GET = withPublicApi(async () => {
    try {
        // Use service role client to bypass RLS for setup check
        const supabase = createServiceRoleClient()

        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })

        if (error) {
            log.error('[SetupCheck] Query error', { error: error.message })
            return NextResponse.json({ setupRequired: false, error: error.message })
        }

        const setupRequired = (count ?? 0) === 0
        log.info('[SetupCheck] Checked', { count, setupRequired })

        return NextResponse.json({ setupRequired })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        log.error('[SetupCheck] Error', { error: message })

        // If service role key is missing, skip setup (user can configure manually)
        if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
            return NextResponse.json({ setupRequired: false, error: 'Service role key not configured' })
        }
        return NextResponse.json({ setupRequired: false, error: 'Check failed' })
    }
})
