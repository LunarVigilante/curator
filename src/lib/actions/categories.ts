'use server'

import { db } from '@/lib/db'
import { categories } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { downloadImageFromUrl } from './upload'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function getCategories() {
    return await db.select().from(categories).orderBy(asc(categories.sortOrder))
}

export async function updateCategory(
    id: string,
    data: { name: string; description: string; image: string; color?: string; metadata?: string; isPublic?: boolean }
) {
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

export async function createCategory(data: {
    name: string
    description: string
    image: string
    color: string
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
        userId: null,
        isPublic: data.isPublic || true
    }).returning()

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
    db.transaction((tx) => {
        for (const item of items) {
            tx.update(categories)
                .set({ sortOrder: item.sortOrder })
                .where(eq(categories.id, item.id))
                .run()
        }
    })

    revalidatePath('/')
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

export async function getPublicCategories(query?: string) {
    if (query) {
        return await db.query.categories.findMany({
            where: (categories, { and, eq, like }) => and(
                eq(categories.isPublic, true),
                like(categories.name, `%${query}%`)
            ),
            with: {
                owner: true
            },
            orderBy: (categories, { asc }) => [asc(categories.name)]
        })
    }

    return await db.query.categories.findMany({
        where: (categories, { eq }) => eq(categories.isPublic, true),
        with: {
            owner: true
        },
        orderBy: (categories, { asc }) => [asc(categories.name)]
    })
}

export async function getUserCategories(userId: string) {
    return await db.select()
        .from(categories)
        .where(eq(categories.userId, userId))
        .orderBy(asc(categories.sortOrder))
}

