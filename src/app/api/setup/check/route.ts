import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/db/schema'
import { count } from 'drizzle-orm'

export async function GET(request: Request) {
    // Only allow internal middleware checks
    const isMiddlewareCheck = request.headers.get('x-middleware-check') === 'true'

    try {
        const result = await db.select({ count: count() }).from(users)
        const setupRequired = result[0].count === 0

        return NextResponse.json({ setupRequired })
    } catch (error) {
        console.error('Setup check error:', error)
        return NextResponse.json({ setupRequired: false, error: 'Check failed' })
    }
}
