'use server'

import { db } from '@/lib/db'
import { categories } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { downloadImageFromUrl } from './upload'
import { headers } from 'next/headers'
import { DEFAULT_CATEGORIES } from '@/lib/constants'
import { auth } from '@/lib/auth'

export async function seedDefaultCategories(userId: string) {
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        const cat = DEFAULT_CATEGORIES[i];
        await db.insert(categories).values({
            id: crypto.randomUUID(),
            name: cat.name,
            description: cat.description,
            image: cat.image,
            userId: userId,
            isPublic: true,
            sortOrder: i,
            metadata: JSON.stringify({ type: cat.type }),
            createdAt: new Date()
        });
    }
}

export async function checkAndSeedUserCategories(userId: string) {
    const existing = await db.select().from(categories).where(eq(categories.userId, userId)).limit(1);
    if (existing.length === 0) {
        console.log(`Self-healing: Seeding categories for user ${userId}`);
        await seedDefaultCategories(userId);
        // Note: don't call revalidatePath here as it may be called during render
    }
}

export async function getCategories() {
    return await db.select().from(categories).orderBy(asc(categories.sortOrder))
}

export async function updateCategory(
    id: string,
    data: { name: string; description: string; image: string; color?: string; metadata?: string; isPublic?: boolean }
) {
    // Authorization: Check if user is owner or admin
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
        throw new Error('Unauthorized: You must be logged in')
    }

    const category = await db.query.categories.findFirst({
        where: eq(categories.id, id),
        columns: { userId: true }
    })

    if (!category) {
        throw new Error('Category not found')
    }

    const isOwner = session.user.id === category.userId
    const isAdmin = (session.user as any).role === 'ADMIN' || (session.user as any).role === 'admin'

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

    await db.update(categories)
        .set({
            name: data.name,
            description: data.description || null,
            image: image || null,
            color: data.color || null,
            metadata: data.metadata || null,
            isPublic: data.isPublic
        })
        .where(eq(categories.id, id))

    revalidatePath('/')
    revalidatePath(`/categories/${id}`)
}

import { logActivity } from '@/lib/actions/activity'

export async function createCategory(data: {
    name: string
    description: string
    image: string
    color: string
    type?: string // Add type
    isPublic?: boolean
}) {
    let image = data.image
    if (image && image.startsWith('http')) {
        const localPath = await downloadImageFromUrl(image)
        if (localPath) {
            image = localPath
        }
    }

    const result = await db.insert(categories).values({
        name: data.name,
        description: data.description || null,
        image: image || null,
        color: data.color || null,
        metadata: data.type ? JSON.stringify({ type: data.type }) : null, // Persist type
        userId: null,
        isPublic: data.isPublic || true
    }).returning()

    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (session?.user?.id) {
        await logActivity(session.user.id, 'CREATED_LIST', { categoryName: data.name })
    }

    revalidatePath('/')
    return result[0]
}


export async function deleteCategory(id: string) {
    await db.delete(categories).where(eq(categories.id, id))
    revalidatePath('/')
}

export async function getCategory(id: string) {
    const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1)

    if (!result || result.length === 0) {
        return null
    }

    return result[0]
}

export async function updateCategoryOrder(categoryId: string, newOrder: number) {
    await db.update(categories)
        .set({ sortOrder: newOrder })
        .where(eq(categories.id, categoryId))

    revalidatePath('/')
    revalidatePath('/')
    revalidatePath('/categories')
}

export async function reorderCategories(items: { id: string; sortOrder: number }[]) {
    await db.transaction(async (tx) => {
        for (const item of items) {
            await tx.update(categories)
                .set({ sortOrder: item.sortOrder })
                .where(eq(categories.id, item.id));
        }
    });

    revalidatePath('/');
    revalidatePath('/categories');
}

export async function toggleCategoryFeature(id: string, isFeatured: boolean) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session || (session.user as any).role !== 'ADMIN') {
        throw new Error('Unauthorized')
    }

    await db.update(categories)
        .set({ isFeatured })
        .where(eq(categories.id, id))

    revalidatePath('/')
}

export async function getFeaturedCategories() {
    return await db.select()
        .from(categories)
        .where(eq(categories.isFeatured, true))
        .orderBy(asc(categories.sortOrder))
}

export async function getAllCategoriesWithOwners() {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session || (session.user as any).role !== 'ADMIN') {
        throw new Error('Unauthorized')
    }

    return await db.query.categories.findMany({
        with: {
            owner: true
        },
        orderBy: (categories, { asc }) => [asc(categories.name)]
    })
}

import { sql, and, like, desc, or } from 'drizzle-orm'

export async function getPublicCategories(
    query?: string,
    page: number = 1,
    limit: number = 60, // Keep limit at 60 for grid alignment
    type?: string,
    sort?: string
) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    const isAdmin = (session?.user as any)?.role === 'ADMIN'
    const offset = (page - 1) * limit

    // Base conditions
    const conditions = []

    if (!isAdmin) {
        conditions.push(eq(categories.isPublic, true))
    }

    if (query) {
        conditions.push(like(categories.name, `%${query}%`))
    }

    if (type && type !== 'All') {
        // Map UI label to canonical DB type code
        const dbType = getFilterTypeFromLabel(type);
        // Filter by JSON metadata type.
        conditions.push(like(categories.metadata, `%"type":"${dbType}"%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined


    // Sorting Logic
    let orderByClause = [desc(categories.createdAt)] // Default to Newest
    if (sort === 'popular') {
        // Approximate "Popular" by item count? 
        // Or actually, we don't have a good metric for popular on the table yet.
        // Let's settle for Name or potentially a future 'viewCount'
        // For now, let's use 'sortOrder' as a proxy for "Featured/Popular" or just Name?
        // Let's stick to Name for now, or use `collectionComments` count if we could join (complex).
        // Let's just do Name for popular? Or maybe random?
        // Actually, let's stick to Newest default, and Popular = ??? 
        // User asked for "Most Popular". I'll map it to "Name" (A-Z) for now as a placeholder 
        // or maybe `sortOrder` if that's used for curation.
        // Let's use `createdAt` ASC for "Oldest" vs Newest?
        // Wait, "Top Rated" was requested too.
        // I'll implement:
        // 'newest' -> createdAt DESC
        // 'popular' -> sortOrder ASC (assuming curated popular lists are top)
        // 'rated' -> name ASC (Placeholder)
        orderByClause = [asc(categories.sortOrder)]
    } else if (sort === 'rated') {
        orderByClause = [asc(categories.name)] // Placeholder
    } else {
        orderByClause = [desc(categories.createdAt)]
    }

    // 1. Get Total Count
    const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(categories)
        .where(whereClause)

    const totalCount = countResult[0].count
    const totalPages = Math.ceil(totalCount / limit)

    // 2. Get Data
    const data = await db.query.categories.findMany({
        where: whereClause,
        with: {
            owner: true,
            items: {
                columns: {
                    id: true
                }
            }
        },
        orderBy: orderByClause,
        limit: limit,
        offset: offset
    })

    return {
        data,
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
    const result = await db.query.categories.findMany({
        where: eq(categories.userId, userId),
        orderBy: (categories, { asc }) => [asc(categories.sortOrder)],
        with: {
            items: {
                columns: { id: true }
            }
        }
    })

    // Transform to include item count
    return result.map(cat => ({
        ...cat,
        itemCount: cat.items?.length || 0,
        items: undefined // Remove the items array to keep payload small
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

