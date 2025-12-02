'use server'

import { db } from '@/lib/db'
import { categories } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function getCategories() {
    return await db.select().from(categories)
}

export async function updateCategory(
    id: string,
    data: { name: string; description: string; image: string; color?: string; metadata?: string }
) {
    await db.update(categories)
        .set({
            name: data.name,
            description: data.description || null,
            image: data.image || null,
            color: data.color || null,
            metadata: data.metadata || null
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
}) {
    const result = await db.insert(categories).values({
        name: data.name,
        description: data.description || null,
        image: data.image || null,
        color: data.color || null
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
