'use server'

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'
import { normalizeTagName } from '@/lib/utils/normalizeTagName'

export async function getTags() {
    const supabase = createServiceRoleClient()

    const { data, error } = await (supabase.from('tags') as any)
        .select('*')
        .order('name', { ascending: true })
        .limit(500) // Limit for performance, use getTagsByIds for specific lookups

    if (error) throw error
    return data || []
}

export async function getTagsByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
    if (ids.length === 0) return []

    const supabase = createServiceRoleClient()

    const { data, error } = await (supabase.from('tags') as any)
        .select('id, name')
        .in('id', ids)

    if (error) throw error
    return data || []
}

export async function createTag(name: string) {
    const supabase = createServiceRoleClient()
    const normalizedName = normalizeTagName(name)

    if (!normalizedName) return null

    // Check if tag already exists with any case variant using ilike
    // This finds 'action', 'Action', 'ACTION' etc.
    const { data: existing } = await (supabase.from('tags') as any)
        .select('*')
        .ilike('name', normalizedName)
        .limit(1)
        .maybeSingle()

    if (existing) {
        return existing
    }

    // Try to insert, but handle unique constraint gracefully
    const { data: newTag, error } = await (supabase.from('tags') as any)
        .insert({ name: normalizedName })
        .select()
        .single()

    if (error) {
        // If duplicate key error (23505), the tag was created by another concurrent request
        // Fetch and return the existing tag
        if (error.code === '23505') {
            const { data: retryExisting } = await (supabase.from('tags') as any)
                .select('*')
                .eq('name', normalizedName)
                .single()
            return retryExisting
        }
        throw error
    }

    revalidatePath('/tags')
    return newTag
}

/**
 * Batch create tags - much faster than individual createTag calls
 * Uses upsert with ON CONFLICT to handle existing tags efficiently
 */
export async function createTagsBatch(names: string[]): Promise<{ id: string, name: string }[]> {
    if (names.length === 0) return []

    const supabase = createServiceRoleClient()
    // Normalize and dedupe tag names
    const normalizedNames = names.map(n => normalizeTagName(n)).filter(n => n.length > 0)
    const uniqueNames = [...new Set(normalizedNames)]

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

        if (error) {
            console.error('[Tags] Failed to insert tags:', error)
        } else if (data) {
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
    const supabase = createServiceRoleClient()

    const { error } = await (supabase.from('tags') as any)
        .delete()
        .eq('id', id)

    if (error) throw error
    revalidatePath('/tags')
}
