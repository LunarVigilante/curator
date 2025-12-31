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

/**
 * Batch create tags - much faster than individual createTag calls
 * Uses upsert with ON CONFLICT to handle existing tags efficiently
 */
export async function createTagsBatch(names: string[]): Promise<{ id: string, name: string }[]> {
    if (names.length === 0) return []

    const supabase = await createClient()
    const uniqueNames = [...new Set(names.map(n => n.trim()).filter(n => n.length > 0))]

    // 1. First, get all existing tags in one query
    const { data: existing } = await (supabase.from('tags') as any)
        .select('id, name')
        .in('name', uniqueNames)

    const existingMap = new Map((existing || []).map((t: any) => [t.name.toLowerCase(), t]))

    // 2. Find which tags need to be created
    const toCreate = uniqueNames.filter(name => !existingMap.has(name.toLowerCase()))

    // 3. Batch insert new tags (if any)
    let newTags: any[] = []
    if (toCreate.length > 0) {
        const { data, error } = await (supabase.from('tags') as any)
            .insert(toCreate.map(name => ({ name })))
            .select('id, name')

        if (!error && data) {
            newTags = data
        }
    }

    // 4. Combine existing + new
    const allTags = [...(existing || []), ...newTags]

    // 5. Return in original order (or close to it)
    return uniqueNames
        .map(name => allTags.find((t: any) => t.name.toLowerCase() === name.toLowerCase()))
        .filter((t): t is { id: string, name: string } => t !== null && t !== undefined)
}

export async function deleteTag(id: string) {
    const supabase = await createClient()

    const { error } = await (supabase.from('tags') as any)
        .delete()
        .eq('id', id)

    if (error) throw error
    revalidatePath('/tags')
}
