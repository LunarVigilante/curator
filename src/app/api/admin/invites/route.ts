import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invites, users } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

// GET - List all invites
export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if admin
        if (session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Fetch all invites with creator info
        const result = await db
            .select({
                id: invites.id,
                code: invites.code,
                isUsed: invites.isUsed,
                createdAt: invites.createdAt,
                usedAt: invites.usedAt,
                createdBy: invites.createdBy,
                usedBy: invites.usedBy,
                creatorName: users.name,
                creatorEmail: users.email,
            })
            .from(invites)
            .leftJoin(users, eq(invites.createdBy, users.id))
            .orderBy(desc(invites.createdAt))

        return NextResponse.json(result)
    } catch (error) {
        console.error('Failed to fetch invites:', error)
        return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 })
    }
}

// POST - Generate new invite code
export async function POST() {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if admin
        if (session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Generate random 8-character alphanumeric code (uppercase)
        const code = Array.from({ length: 8 }, () =>
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))
        ).join('')

        // Insert new invite
        const [newInvite] = await db
            .insert(invites)
            .values({
                code,
                createdBy: session.user.id,
                isUsed: false,
            })
            .returning()

        return NextResponse.json({
            ...newInvite,
            creatorName: session.user.name,
            creatorEmail: session.user.email,
        })
    } catch (error) {
        console.error('Failed to generate invite:', error)
        return NextResponse.json({ error: 'Failed to generate invite' }, { status: 500 })
    }
}

// DELETE - Revoke invite
export async function DELETE(request: Request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if admin
        if (session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Invite ID required' }, { status: 400 })
        }

        await db.delete(invites).where(eq(invites.id, id))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete invite:', error)
        return NextResponse.json({ error: 'Failed to delete invite' }, { status: 500 })
    }
}
