import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
        return NextResponse.json({ valid: false, message: 'Code required' }, { status: 400 })
    }

    try {
        const supabase = await createClient()

        // Fetch invite without filtering by is_used - check use_count instead
        const { data: invite, error } = await (supabase as any)
            .from('invites')
            .select('*')
            .eq('code', code)
            .single()

        if (error || !invite) {
            return NextResponse.json({ valid: false, message: 'Invalid code' })
        }

        // Check if invite has uses remaining
        const useCount = invite.use_count || 0
        const maxUses = invite.max_uses || 1
        if (useCount >= maxUses) {
            return NextResponse.json({ valid: false, message: 'This code has reached its usage limit' })
        }

        return NextResponse.json({ valid: true, message: `Valid code (${maxUses - useCount} uses remaining)` })
    } catch (error) {
        console.error('Invite check error:', error)
        return NextResponse.json({ valid: false, message: 'Error checking code' }, { status: 500 })
    }
}
