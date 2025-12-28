import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invites } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
        return NextResponse.json({ valid: false, message: 'Code required' }, { status: 400 })
    }

    try {
        const invite = await db.query.invites.findFirst({
            where: and(
                eq(invites.code, code),
                eq(invites.isUsed, false)
            )
        })

        if (!invite) {
            return NextResponse.json({ valid: false, message: 'Invalid or expired code' })
        }

        return NextResponse.json({ valid: true, message: 'Valid code' })
    } catch (error) {
        console.error('Invite check error:', error)
        return NextResponse.json({ valid: false, message: 'Error checking code' }, { status: 500 })
    }
}
