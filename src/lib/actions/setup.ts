'use server'

import { createClient } from '@/lib/supabase/server'
import { seedDefaultCategories } from './categories'

/**
 * Check if the application needs initial setup (no users exist).
 */
export async function isSetupRequired(): Promise<boolean> {
    const supabase = await createClient()

    const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    if (error) return true
    return count === 0
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

    const supabase = await createClient()

    try {
        // Create admin user via Supabase Auth
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    role: 'ADMIN',
                },
            },
        })

        if (signUpError || !authData.user) {
            return { error: signUpError?.message || 'Failed to create user' }
        }

        // Wait for the trigger to create the profile, then update it to be admin
        // The trigger may take a moment to create the profile
        let profileUpdated = false
        for (let attempt = 0; attempt < 5; attempt++) {
            // Small delay to allow trigger to execute
            await new Promise(resolve => setTimeout(resolve, 500))

            const { error: updateError } = await (supabase
                .from('profiles') as any)
                .update({
                    name,
                    role: 'ADMIN',
                    email_verified: true,
                })
                .eq('id', authData.user.id)

            if (!updateError) {
                profileUpdated = true
                break
            }
            console.log(`Setup: Profile update attempt ${attempt + 1} failed:`, updateError.message)
        }

        if (!profileUpdated) {
            console.error('Setup: Failed to update profile to admin role after 5 attempts')
            // Don't return error - the user was created, just may not be admin
        }

        // Seed default categories for admin
        await seedDefaultCategories(authData.user.id)

        return { success: true }
    } catch (error: any) {
        console.error('Setup error:', error)
        return { error: error.message || 'Failed to complete setup' }
    }
}
