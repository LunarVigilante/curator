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

        const { data: invite, error } = await supabase
            .from('invites')
            .select('*')
            .eq('code', code)
            .eq('is_used', false)
            .single()

        if (error || !invite) {
            return NextResponse.json({ valid: false, message: 'Invalid or expired code' })
        }

        return NextResponse.json({ valid: true, message: 'Valid code' })
    } catch (error) {
        console.error('Invite check error:', error)
        return NextResponse.json({ valid: false, message: 'Error checking code' }, { status: 500 })
    }
}
