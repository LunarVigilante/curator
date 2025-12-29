import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    try {
        const supabase = await createClient()

        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })

        const setupRequired = (count ?? 0) === 0

        return NextResponse.json({ setupRequired })
    } catch (error) {
        console.error('Setup check error:', error)
        return NextResponse.json({ setupRequired: false, error: 'Check failed' })
    }
}
