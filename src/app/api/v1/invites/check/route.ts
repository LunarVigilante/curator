import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withPublicApi, validationError } from '@/lib/middleware'
import { log } from 'next-axiom'

/**
 * Public invite code validation
 * 
 * This is a PUBLIC route with anonymous rate limiting (10/min).
 * No authentication required - meant for pre-signup validation.
 */
export const GET = withPublicApi(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
        return validationError('Code required')
    }

    try {
        const supabase = await createClient()

        // Use type assertion for table not in generated types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: invite, error } = await (supabase as any)
            .from('invites')
            .select('*')
            .eq('code', code)
            .single()

        if (error || !invite) {
            return NextResponse.json({ valid: false, message: 'Invalid code' })
        }

        // Check if invite has uses remaining
        const useCount = invite.use_count ?? 0
        const maxUses = invite.max_uses ?? 1
        if (useCount >= maxUses) {
            return NextResponse.json({ valid: false, message: 'This code has reached its usage limit' })
        }

        return NextResponse.json({ valid: true, message: `Valid code (${maxUses - useCount} uses remaining)` })
    } catch (error) {
        log.error('[InviteCheck] Error', { error: String(error) })
        return NextResponse.json({ valid: false, message: 'Error checking code' }, { status: 500 })
    }
})
