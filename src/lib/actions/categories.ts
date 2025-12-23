'use server'

import { db } from '@/lib/db'
import { categories } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { downloadImageFromUrl } from './upload'

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
