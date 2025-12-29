'use server'

import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

type AdminCheckResult =
    | { authorized: true; user: { id: string; email: string; name: string; role: string } }
    | { authorized: false; error: string }

/**
 * Reusable admin guard for server actions and API routes.
 * Returns the user if authorized, or an error if not.
 */
export async function requireAdmin(): Promise<AdminCheckResult> {
    const session = await getSession()

    if (!session) {
        return { authorized: false, error: 'Unauthorized - Please sign in' }
    }

    const role = session.profile?.role
    if (role !== 'ADMIN') {
        return { authorized: false, error: 'Forbidden - Admin access required' }
    }

    return {
        authorized: true,
        user: {
            id: session.user.id,
            email: session.user.email || '',
            name: session.profile?.name || '',
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
export async function isAdminGuard(): Promise<boolean> {
    const result = await requireAdmin()
    return result.authorized
}
