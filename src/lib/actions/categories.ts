'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { downloadImageFromUrl } from './upload'
import { DEFAULT_CATEGORIES } from '@/lib/constants'
import { getSession } from '@/lib/auth'

export async function seedDefaultCategories(userId: string) {
    const supabase = await createClient()

    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        const cat = DEFAULT_CATEGORIES[i]
        await (supabase.from('categories') as any).insert({
            name: cat.name,
            description: cat.description,
            image: cat.image,
            user_id: userId,
            is_public: true,
            sort_order: i,
            metadata: { type: cat.type }
        })
    }
}

export async function checkAndSeedUserCategories(userId: string) {
    const supabase = await createClient()

    const { data: existing } = await (supabase.from('categories') as any)
        .select('id')
        .eq('user_id', userId)
        .limit(1)

    if (!existing || existing.length === 0) {
        console.log(`Self-healing: Seeding categories for user ${userId}`)
        await seedDefaultCategories(userId)
    }
}

export async function getCategories() {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('categories') as any)
        .select('*')
        .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
}

export async function updateCategory(
    id: string,
    data: { name: string; description: string; image: string; color?: string; metadata?: any; isPublic?: boolean }
) {
    const supabase = await createClient()
    const session = await getSession()

    if (!session) {
        throw new Error('Unauthorized: You must be logged in')
    }

    // Check ownership
    const { data: category } = await (supabase.from('categories') as any)
        .select('user_id')
        .eq('id', id)
        .single()

    if (!category) {
        throw new Error('Category not found')
    }

    const isOwner = session.user.id === category.user_id
    const isAdmin = session.profile?.role === 'ADMIN'

    if (!isOwner && !isAdmin) {
        throw new Error('Forbidden: You do not have permission to edit this collection')
    }

    let image = data.image
    if (image && image.startsWith('http')) {
        const localPath = await downloadImageFromUrl(image)
        if (localPath) {
            image = localPath
        }
    }

    const { error } = await (supabase.from('categories') as any)
        .update({
            name: data.name,
            description: data.description || null,
            image: image || null,
            color: data.color || null,
            metadata: data.metadata || null,
            is_public: data.isPublic
        })
        .eq('id', id)

    if (error) throw error

    revalidatePath('/')
    revalidatePath(`/categories/${id}`)
}

import { logActivity } from '@/lib/actions/activity'

export async function createCategory(data: {
    name: string
    description: string
    image: string
    color: string
    type?: string
    isPublic?: boolean
}) {
    const supabase = await createClient()
    const session = await getSession()

    let image = data.image
    if (image && image.startsWith('http')) {
        const localPath = await downloadImageFromUrl(image)
        if (localPath) {
            image = localPath
        }
    }

    const { data: result, error } = await (supabase.from('categories') as any)
        .insert({
            name: data.name,
            description: data.description || null,
            image: image || null,
            color: data.color || null,
            metadata: data.type ? { type: data.type } : null,
            user_id: session?.user?.id || null,
            is_public: data.isPublic ?? true
        })
        .select()
        .single()

    if (error) throw error

    if (session?.user?.id) {
        await logActivity(session.user.id, 'CREATED_LIST', { categoryName: data.name })
    }

    revalidatePath('/')
    return result
}

export async function deleteCategory(id: string) {
    const supabase = await createClient()

    const { error } = await (supabase.from('categories') as any)
        .delete()
        .eq('id', id)

    if (error) throw error
    revalidatePath('/')
}

export async function getCategory(id: string) {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('categories') as any)
        .select('*')
        .eq('id', id)
        .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
}

export async function updateCategoryOrder(categoryId: string, newOrder: number) {
    const supabase = await createClient()

    const { error } = await (supabase.from('categories') as any)
        .update({ sort_order: newOrder })
        .eq('id', categoryId)

    if (error) throw error

    revalidatePath('/')
    revalidatePath('/categories')
}

export async function reorderCategories(items: { id: string; sortOrder: number }[]) {
    const supabase = await createClient()

    // Supabase doesn't have transactions in the client, so we batch updates
    for (const item of items) {
        const { error } = await (supabase.from('categories') as any)
            .update({ sort_order: item.sortOrder })
            .eq('id', item.id)

        if (error) throw error
    }

    revalidatePath('/')
    revalidatePath('/categories')
}

export async function toggleCategoryFeature(id: string, isFeatured: boolean) {
    const session = await getSession()

    if (!session || session.profile?.role !== 'ADMIN') {
        throw new Error('Unauthorized')
    }

    const supabase = await createClient()

    const { error } = await (supabase.from('categories') as any)
        .update({ is_featured: isFeatured })
        .eq('id', id)

    if (error) throw error
    revalidatePath('/')
}

export async function getFeaturedCategories() {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('categories') as any)
        .select('*')
        .eq('is_featured', true)
        .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
}

export async function getAllCategoriesWithOwners() {
    const session = await getSession()

    if (!session || session.profile?.role !== 'ADMIN') {
        throw new Error('Unauthorized')
    }

    const supabase = await createClient()

    const { data, error } = await (supabase.from('categories') as any)
        .select(`
            *,
            owner:profiles!categories_user_id_fkey(*)
        `)
        .order('name', { ascending: true })

    if (error) throw error
    return data || []
}

export async function getPublicCategories(
    query?: string,
    page: number = 1,
    limit: number = 60,
    type?: string,
    sort?: string
) {
    const session = await getSession()
    const isAdmin = session?.profile?.role === 'ADMIN'
    const offset = (page - 1) * limit
    const supabase = await createClient()

    // Build query
    let queryBuilder = (supabase.from('categories') as any)
        .select('*, owner:profiles!categories_user_id_fkey(*), items(id)', { count: 'exact' })

    // Apply filters
    if (!isAdmin) {
        queryBuilder = queryBuilder.eq('is_public', true)
    }

    if (query) {
        queryBuilder = queryBuilder.ilike('name', `%${query}%`)
    }

    if (type && type !== 'All') {
        const dbType = getFilterTypeFromLabel(type)
        queryBuilder = queryBuilder.contains('metadata', { type: dbType })
    }

    // Apply sorting
    if (sort === 'popular') {
        queryBuilder = queryBuilder.order('sort_order', { ascending: true })
    } else if (sort === 'rated') {
        queryBuilder = queryBuilder.order('name', { ascending: true })
    } else {
        queryBuilder = queryBuilder.order('created_at', { ascending: false })
    }

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1)

    const { data, count, error } = await queryBuilder

    if (error) throw error

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    return {
        data: data || [],
        metadata: {
            currentPage: page,
            totalPages,
            totalCount,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        }
    }
}

export async function getUserCategories(userId: string) {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('categories') as any)
        .select('*, items(id)')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })

    if (error) throw error

    // Transform to include item count
    return (data || []).map((cat: any) => ({
        ...cat,
        itemCount: cat.items?.length || 0,
        items: undefined
    }))
}

function getFilterTypeFromLabel(label: string): string {
    switch (label.toLowerCase()) {
        case 'movies': return 'movie'
        case 'tv shows': return 'tv'
        case 'anime': return 'anime'
        case 'video games': return 'game'
        case 'books': return 'book'
        case 'music': return 'music'
        case 'podcasts': return 'podcast'
        case 'board games': return 'board_game'
        case 'comics': return 'comic'
        default: return label.toLowerCase().replace(' ', '_')
    }
}
