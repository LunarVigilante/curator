import { getSession, isAdmin } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Invite {
    id: string
    code: string
    is_used: boolean
    created_at: string
    used_at: string | null
    created_by: string
    used_by: string | null
}

// GET - List all invites
export async function GET() {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await isAdmin())) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase = await createClient()

        // Use type assertion to bypass Supabase type inference
        const { data: result, error } = await (supabase as any)
            .from('invites')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        const mapped = ((result || []) as Invite[]).map((invite) => ({
            id: invite.id,
            code: invite.code,
            isUsed: invite.is_used,
            createdAt: invite.created_at,
            usedAt: invite.used_at,
            createdBy: invite.created_by,
            usedBy: invite.used_by,
        }))

        return NextResponse.json(mapped)
    } catch (error) {
        console.error('Failed to fetch invites:', error)
        return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 })
    }
}

// POST - Generate new invite code
export async function POST() {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await isAdmin())) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase = await createClient()

        const code = Array.from({ length: 8 }, () =>
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))
        ).join('')

        // Use type assertion to bypass Supabase type inference
        const { data: newInvite, error } = await (supabase as any)
            .from('invites')
            .insert({
                code,
                created_by: session.user.id,
                is_used: false,
            })
            .select()
            .single()

        if (error) throw error

        const invite = newInvite as Invite

        return NextResponse.json({
            id: invite.id,
            code: invite.code,
            isUsed: invite.is_used,
            createdAt: invite.created_at,
            createdBy: invite.created_by,
            creatorName: session.profile?.name,
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
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await isAdmin())) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Invite ID required' }, { status: 400 })
        }

        const supabase = await createClient()
        await (supabase as any).from('invites').delete().eq('id', id)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete invite:', error)
        return NextResponse.json({ error: 'Failed to delete invite' }, { status: 500 })
    }
}
