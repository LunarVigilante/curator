import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await createClient()

        const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })

        const setupRequired = (count ?? 0) === 0

        return NextResponse.json({ setupRequired })
    } catch {
        return NextResponse.json({ setupRequired: false })
    }
}
