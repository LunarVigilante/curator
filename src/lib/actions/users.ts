'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function updateUserProfile(data: {
    name?: string
    email?: string
    bio?: string
    image?: string
    preferences?: any
}) {
    const session = await getSession()

    if (!session) {
        throw new Error("Unauthorized")
    }

    const supabase = await createClient()
    const { name, email, bio, image, preferences } = data

    const preferencesString = preferences ? JSON.stringify(preferences) : undefined

    await (supabase
        .from('profiles') as any)
        .update({
            ...(name && { name }),
            ...(bio && { bio }),
            ...(image && { image }),
            ...(preferencesString && { preferences: preferencesString }),
            updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id)

    // If email change requested, use Supabase Auth
    if (email && email !== session.user.email) {
        await supabase.auth.updateUser({ email })
    }

    revalidatePath('/settings')
    revalidatePath('/')
    return { success: true }
}

export async function deleteUserAccount() {
    const session = await getSession()

    if (!session) {
        throw new Error("Unauthorized")
    }

    const supabase = await createClient()

    // Delete profile (cascade will handle related data)
    await supabase
        .from('profiles')
        .delete()
        .eq('id', session.user.id)

    // Sign out
    await supabase.auth.signOut()

    return { success: true }
}

export async function getUserById(userId: string) {
    const supabase = await createClient()

    const { data: user, error } = await (supabase
        .from('profiles') as any)
        .select('id, name, image, bio, created_at')
        .eq('id', userId)
        .single()

    if (error || !user) return null

    return {
        id: user.id,
        name: user.name,
        image: user.image,
        bio: user.bio,
        createdAt: user.created_at
    }
}

export async function changePassword(data: {
    currentPassword?: string
    newPassword: string
}) {
    const session = await getSession()

    if (!session) {
        throw new Error("Unauthorized")
    }

    const supabase = await createClient()
    const { newPassword } = data

    // Update password via Supabase Auth
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/settings')
    return { success: true }
}
