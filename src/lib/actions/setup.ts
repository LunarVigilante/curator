'use server'

import { db } from '@/lib/db'
import { users, accounts } from '@/db/schema'
import { count, eq } from 'drizzle-orm'
import { hash } from 'bcryptjs'
import { seedDefaultCategories } from './categories'

/**
 * Check if the application needs initial setup (no users exist).
 */
export async function isSetupRequired(): Promise<boolean> {
    const result = await db.select({ count: count() }).from(users)
    return result[0].count === 0
}

/**
 * Complete the initial setup by creating the first admin user.
 * This can only be called when no users exist in the database.
 */
export async function completeSetup(
    prevState: { success?: boolean; error?: string } | undefined,
    formData: FormData
): Promise<{ success?: boolean; error?: string }> {
    const email = formData.get('email') as string
    const name = formData.get('name') as string
    const password = formData.get('password') as string

    // Validate inputs
    if (!email || !name || !password) {
        return { error: 'All fields are required' }
    }

    if (password.length < 8) {
        return { error: 'Password must be at least 8 characters' }
    }

    // Security check: Only allow setup if no users exist
    const setupRequired = await isSetupRequired()
    if (!setupRequired) {
        return { error: 'Setup has already been completed' }
    }

    try {
        // Hash password
        const hashedPassword = await hash(password, 10)

        // Create admin user
        const [newUser] = await db.insert(users).values({
            email,
            name,
            role: 'admin',
            emailVerified: true, // Admin doesn't need email verification
        }).returning()

        // Create account for password login
        await db.insert(accounts).values({
            accountId: newUser.id,
            userId: newUser.id,
            providerId: 'credential',
            password: hashedPassword,
        })

        // Seed default categories for admin
        await seedDefaultCategories(newUser.id)

        return { success: true }
    } catch (error: any) {
        console.error('Setup error:', error)
        return { error: error.message || 'Failed to complete setup' }
    }
}
