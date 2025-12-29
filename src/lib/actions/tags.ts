'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getTags() {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('tags') as any)
        .select('*')
        .order('name', { ascending: false })

    if (error) throw error
    return data || []
}

export async function createTag(name: string) {
    const supabase = await createClient()

    // Check if tag already exists
    const { data: existing } = await (supabase.from('tags') as any)
        .select('*')
        .eq('name', name)
        .single()

    if (existing) {
        return existing
    }

    const { data: newTag, error } = await (supabase.from('tags') as any)
        .insert({ name })
        .select()
        .single()

    if (error) throw error

    revalidatePath('/tags')
    return newTag
}

export async function deleteTag(id: string) {
    const supabase = await createClient()

    const { error } = await (supabase.from('tags') as any)
        .delete()
        .eq('id', id)

    if (error) throw error
    revalidatePath('/tags')
}
