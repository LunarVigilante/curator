'use server'

import { db } from '@/lib/db'
import { curatorNotes, items, categories } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

// ============================================================================
// Auth Helper
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id || null
}

// ============================================================================
// Curator Notes Types
// ============================================================================

export type CuratorNote = {
    id: string
    content: string
    isPinned: boolean
    createdAt: Date
    updatedAt: Date
}

// ============================================================================
// Curator Notes Actions
// ============================================================================

/**
 * Get curator note for an item (if exists)
 */
export async function getCuratorNote(itemId: string): Promise<CuratorNote | null> {
    const note = await db.query.curatorNotes.findFirst({
        where: eq(curatorNotes.itemId, itemId),
        columns: {
            id: true,
            content: true,
            isPinned: true,
            createdAt: true,
            updatedAt: true,
        }
    })

    return note || null
}

/**
 * Create or update a curator note on an item
 * Only the collection owner can add notes
 */
export async function upsertCuratorNote(
    itemId: string,
    content: string
): Promise<{ success: boolean; error?: string; note?: CuratorNote }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get the item and verify ownership
    const item = await db.query.items.findFirst({
        where: eq(items.id, itemId),
        columns: { id: true, categoryId: true }
    })

    if (!item) {
        return { success: false, error: 'Item not found' }
    }

    // Check if user owns the category (collection)
    if (item.categoryId) {
        const category = await db.query.categories.findFirst({
            where: eq(categories.id, item.categoryId),
            columns: { userId: true }
        })

        if (category?.userId !== userId) {
            return { success: false, error: 'Only the collection owner can add curator notes' }
        }
    }

    try {
        // Check if note already exists
        const existing = await db.query.curatorNotes.findFirst({
            where: eq(curatorNotes.itemId, itemId)
        })

        let note: CuratorNote

        if (existing) {
            // Update existing note
            await db.update(curatorNotes)
                .set({ content, updatedAt: new Date() })
                .where(eq(curatorNotes.id, existing.id))

            note = { ...existing, content, updatedAt: new Date() }
        } else {
            // Create new note
            const newNote = await db.insert(curatorNotes)
                .values({
                    itemId,
                    userId,
                    content,
                    isPinned: true,
                })
                .returning()

            note = {
                id: newNote[0].id,
                content: newNote[0].content,
                isPinned: newNote[0].isPinned,
                createdAt: newNote[0].createdAt,
                updatedAt: newNote[0].updatedAt,
            }
        }

        revalidatePath('/categories')
        return { success: true, note }
    } catch (error) {
        console.error('Failed to upsert curator note:', error)
        return { success: false, error: 'Failed to save note' }
    }
}

/**
 * Delete a curator note
 */
export async function deleteCuratorNote(noteId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Verify ownership
    const note = await db.query.curatorNotes.findFirst({
        where: eq(curatorNotes.id, noteId),
        columns: { userId: true }
    })

    if (!note) {
        return { success: false, error: 'Note not found' }
    }

    if (note.userId !== userId) {
        return { success: false, error: 'Not authorized to delete this note' }
    }

    try {
        await db.delete(curatorNotes).where(eq(curatorNotes.id, noteId))
        revalidatePath('/categories')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete curator note:', error)
        return { success: false, error: 'Failed to delete note' }
    }
}

/**
 * Toggle pin status of a note
 */
export async function toggleNotePin(noteId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const note = await db.query.curatorNotes.findFirst({
        where: eq(curatorNotes.id, noteId),
        columns: { id: true, userId: true, isPinned: true }
    })

    if (!note || note.userId !== userId) {
        return { success: false, error: 'Note not found or not authorized' }
    }

    try {
        await db.update(curatorNotes)
            .set({ isPinned: !note.isPinned })
            .where(eq(curatorNotes.id, noteId))

        revalidatePath('/categories')
        return { success: true }
    } catch (error) {
        console.error('Failed to toggle note pin:', error)
        return { success: false, error: 'Failed to update note' }
    }
}

/**
 * Get all curator notes for items in a category
 */
export async function getCategoryNotes(categoryId: string): Promise<Map<string, CuratorNote>> {
    const notes = await db
        .select({
            id: curatorNotes.id,
            itemId: curatorNotes.itemId,
            content: curatorNotes.content,
            isPinned: curatorNotes.isPinned,
            createdAt: curatorNotes.createdAt,
            updatedAt: curatorNotes.updatedAt,
        })
        .from(curatorNotes)
        .innerJoin(items, eq(curatorNotes.itemId, items.id))
        .where(eq(items.categoryId, categoryId))

    const noteMap = new Map<string, CuratorNote>()
    for (const note of notes) {
        noteMap.set(note.itemId, {
            id: note.id,
            content: note.content,
            isPinned: note.isPinned,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
        })
    }

    return noteMap
}
