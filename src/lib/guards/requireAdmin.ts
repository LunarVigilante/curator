'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

type AdminCheckResult =
    | { authorized: true; user: { id: string; email: string; name: string; role: string } }
    | { authorized: false; error: string }

/**
 * Reusable admin guard for server actions and API routes.
 * Returns the user if authorized, or an error if not.
 */
export async function requireAdmin(): Promise<AdminCheckResult> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return { authorized: false, error: 'Unauthorized - Please sign in' }
    }

    const role = (session.user as any).role
    if (role !== 'ADMIN' && role !== 'admin') {
        return { authorized: false, error: 'Forbidden - Admin access required' }
    }

    return {
        authorized: true,
        user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            role: role
        }
    }
}

/**
 * Throws and redirects if not admin. Use in Server Components.
 */
export async function assertAdminOrRedirect(): Promise<{ id: string; email: string; name: string; role: string }> {
    const result = await requireAdmin()

    if (!result.authorized) {
        redirect('/')
    }

    return result.user
}

/**
 * Check if current user is admin (non-throwing version for conditional rendering)
 */
export async function isAdmin(): Promise<boolean> {
    const result = await requireAdmin()
    return result.authorized
}
