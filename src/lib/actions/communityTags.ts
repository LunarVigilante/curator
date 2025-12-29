'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

// Admin-only tags that regular users cannot add
const ADMIN_ONLY_TAGS = ['#Featured', '#Curated', '#Editor\'s Pick', '#Staff Pick', '#Trending']

// Auto-included tag for public collections
const AUTO_PUBLIC_TAG = '#Community'

export async function addCollectionTag(categoryId: string, tag: string) {
    const session = await getSession()
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const userId = session.user.id
    const isAdmin = session.profile?.role === 'ADMIN'
    const supabase = await createClient()

    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`

    if (ADMIN_ONLY_TAGS.includes(normalizedTag) && !isAdmin) {
        return { success: false, error: 'This tag is restricted to administrators' }
    }

    // Check existing user-added tags count (max 3 per user per collection)
    const { data: existingUserTags } = await (supabase.from('collection_tags') as any)
        .select('*')
        .eq('category_id', categoryId)
        .eq('added_by', userId)

    if ((existingUserTags?.length || 0) >= 3) {
        return { success: false, error: 'You can only add up to 3 tags per collection' }
    }

    // Check if this exact tag already exists on this collection
    const { data: existingTag } = await supabase
        .from('collection_tags')
        .select('*')
        .eq('category_id', categoryId)
        .eq('tag', normalizedTag)
        .single()

    if (existingTag) {
        return { success: false, error: 'This tag already exists on this collection' }
    }

    await (supabase.from('collection_tags') as any).insert({
        category_id: categoryId,
        tag: normalizedTag,
        added_by: userId,
        is_admin_only: ADMIN_ONLY_TAGS.includes(normalizedTag)
    })

    return { success: true, tag: normalizedTag }
}

export async function removeCollectionTag(categoryId: string, tagId: string) {
    const session = await getSession()
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const userId = session.user.id
    const isAdmin = session.profile?.role === 'ADMIN'
    const supabase = await createClient()

    const { data: tag } = await (supabase.from('collection_tags') as any)
        .select('*')
        .eq('id', tagId)
        .single()

    if (!tag) {
        return { success: false, error: 'Tag not found' }
    }

    if (!isAdmin && tag.added_by !== userId) {
        return { success: false, error: 'You can only remove tags you added' }
    }

    if (tag.is_admin_only && !isAdmin) {
        return { success: false, error: 'Admin-only tags can only be removed by administrators' }
    }

    await (supabase.from('collection_tags') as any).delete().eq('id', tagId)

    return { success: true }
}

export async function getCollectionTags(categoryId: string) {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('collection_tags') as any)
        .select('*')
        .eq('category_id', categoryId)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
}

export async function getBatchCollectionTags(categoryIds: string[]) {
    if (categoryIds.length === 0) return {}

    const supabase = await createClient()

    const { data: tags } = await (supabase.from('collection_tags') as any)
        .select('*')
        .in('category_id', categoryIds)

    // Transform to camelCase for component compatibility
    type TransformedTag = {
        id: string
        tag: string
        isAdminOnly: boolean
        categoryId: string
        addedBy: string | null
        createdAt: Date
    }

    const result: Record<string, TransformedTag[]> = {}
    for (const id of categoryIds) {
        result[id] = ((tags || []) as any[])
            .filter((t: any) => t.category_id === id)
            .map((t: any) => ({
                id: t.id,
                tag: t.tag,
                isAdminOnly: t.is_admin_only,
                categoryId: t.category_id,
                addedBy: t.added_by,
                createdAt: new Date(t.created_at)
            }))
    }
    return result
}

export async function ensureCommunityTag(categoryId: string) {
    const supabase = await createClient()

    const { data: category } = await (supabase.from('categories') as any)
        .select('is_public')
        .eq('id', categoryId)
        .single()

    if (!category?.is_public) {
        return { success: false, error: 'Collection is not public' }
    }

    const { data: existingTag } = await supabase
        .from('collection_tags')
        .select('*')
        .eq('category_id', categoryId)
        .eq('tag', AUTO_PUBLIC_TAG)
        .single()

    if (existingTag) {
        return { success: true, exists: true }
    }

    await (supabase.from('collection_tags') as any).insert({
        category_id: categoryId,
        tag: AUTO_PUBLIC_TAG,
        added_by: null,
        is_admin_only: false
    })

    return { success: true, added: true }
}

export async function addAdminTag(categoryId: string, tag: string) {
    const session = await getSession()
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const isAdmin = session.profile?.role === 'ADMIN'
    if (!isAdmin) {
        return { success: false, error: 'Admin access required' }
    }

    const supabase = await createClient()
    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`

    const { data: existingTag } = await supabase
        .from('collection_tags')
        .select('*')
        .eq('category_id', categoryId)
        .eq('tag', normalizedTag)
        .single()

    if (existingTag) {
        return { success: false, error: 'Tag already exists' }
    }

    await (supabase.from('collection_tags') as any).insert({
        category_id: categoryId,
        tag: normalizedTag,
        added_by: session.user.id,
        is_admin_only: true
    })

    return { success: true, tag: normalizedTag }
}
