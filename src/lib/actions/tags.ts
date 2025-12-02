'use server'

import { db } from '@/lib/db'
import { tags } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function getTags() {
    const allTags = await db.select().from(tags).orderBy(desc(tags.name))
    return allTags
}

export async function createTag(name: string) {
    // Check if tag already exists
    const existing = await db.query.tags.findFirst({
        where: eq(tags.name, name)
    })

    if (existing) {
        return existing
    }

    const [newTag] = await db.insert(tags).values({
        name
    }).returning()

    revalidatePath('/tags')
    return newTag
}

export async function deleteTag(id: string) {
    await db.delete(tags).where(eq(tags.id, id))
    revalidatePath('/tags')
}
