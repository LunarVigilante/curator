'use server'

import { db } from '@/lib/db'
import { items, itemsToTags } from '@/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'

export async function getItems(categoryId?: string) {
    const result = await db.query.items.findMany({
        where: categoryId ? eq(items.categoryId, categoryId) : undefined,
        orderBy: [desc(items.createdAt)],
        with: {
            tags: {
                with: {
                    tag: true
                }
            },
            ratings: true
        }
    })

    // Transform to match UI expectation (flatten tags)
    return result.map(item => ({
        ...item,
        tags: item.tags.map(t => t.tag)
    }))
}

export async function getItem(id: string) {
    const item = await db.query.items.findFirst({
        where: eq(items.id, id),
        with: {
            tags: {
                with: {
                    tag: true
                }
            },
            ratings: true
        }
    })

    if (!item) return null

    // Transform to match UI expectation
    return {
        ...item,
        tags: item.tags.map(t => t.tag)
    }
}


export async function createItem(data: FormData | {
    name: string
    description: string
    categoryId: string
    image: string
    tags?: string[] // Add tags to type
}) {
    let name: string
    let description: string
    let categoryId: string
    let image: string
    let metadata: string | null = null
    let tagIds: string[] = []

    if (data instanceof FormData) {
        name = data.get('name') as string
        description = data.get('description') as string
        categoryId = data.get('category') as string
        image = data.get('image') as string
        metadata = data.get('metadata') as string
        const tagsJson = data.get('tags') as string
        if (tagsJson) {
            tagIds = JSON.parse(tagsJson)
        }
    } else {
        name = data.name
        description = data.description
        categoryId = data.categoryId
        image = data.image
        tagIds = data.tags || []
        // metadata not supported in object mode yet
    }

    const [newItem] = await db.insert(items).values({
        name,
        description,
        categoryId,
        image,
        metadata,
    }).returning()

    if (tagIds.length > 0) {
        await db.insert(itemsToTags).values(
            tagIds.map(tagId => ({
                itemId: newItem.id,
                tagId
            }))
        )
    }

    revalidatePath('/items')
    if (categoryId) {
        revalidatePath(`/categories/${categoryId}`)
    }
}

export async function updateItem(id: string, formData: FormData) {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const categoryId = formData.get('category') as string
    const image = formData.get('image') as string
    const metadata = formData.get('metadata') as string
    const tagsJson = formData.get('tags') as string
    let tagIds: string[] = []
    if (tagsJson) {
        tagIds = JSON.parse(tagsJson)
    }

    await db.update(items)
        .set({
            name,
            description,
            categoryId,
            image,
            metadata,
            updatedAt: new Date()
        })
        .where(eq(items.id, id))

    // Update tags
    // First delete existing tags
    await db.delete(itemsToTags).where(eq(itemsToTags.itemId, id))

    // Then insert new tags
    if (tagIds.length > 0) {
        await db.insert(itemsToTags).values(
            tagIds.map(tagId => ({
                itemId: id,
                tagId
            }))
        )
    }

    revalidatePath(`/items/${id}`)
    revalidatePath('/items')
    if (categoryId) {
        revalidatePath(`/categories/${categoryId}`)
    }
}

export async function deleteItem(id: string) {
    await db.delete(items).where(eq(items.id, id))

    revalidatePath('/items')
    redirect('/items')
}
