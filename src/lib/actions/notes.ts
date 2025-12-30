'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserId } from '@/lib/auth'

// ============================================================================
// Curator Notes Types
// ============================================================================

export type CuratorNote = {
    id: string
    content: string
    isPinned: boolean
    createdAt: string
    updatedAt: string
}

// ============================================================================
// Curator Notes Actions
// ============================================================================

export async function getCuratorNote(itemId: string): Promise<CuratorNote | null> {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('curator_notes') as any)
        .select('id, content, is_pinned, created_at, updated_at')
        .eq('item_id', itemId)
        .single()

    if (error || !data) return null

    return {
        id: data.id,
        content: data.content,
        isPinned: data.is_pinned,
        createdAt: data.created_at,
        updatedAt: data.updated_at
    }
}

export async function upsertCuratorNote(
    itemId: string,
    content: string
): Promise<{ success: boolean; error?: string; note?: CuratorNote }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    // Get the item and verify ownership
    const { data: item } = await (supabase.from('items') as any)
        .select('id, category_id')
        .eq('id', itemId)
        .single()

    if (!item) {
        return { success: false, error: 'Item not found' }
    }

    // Check if user owns the category
    if (item.category_id) {
        const { data: category } = await (supabase.from('categories') as any)
            .select('user_id')
            .eq('id', item.category_id)
            .single()

        if (category?.user_id !== userId) {
            return { success: false, error: 'Only the collection owner can add curator notes' }
        }
    }

    try {
        // Check if note already exists
        const { data: existing } = await (supabase.from('curator_notes') as any)
            .select('*')
            .eq('item_id', itemId)
            .single()

        let note: CuratorNote

        if (existing) {
            // Update existing note
            const { data: updated, error } = await (supabase.from('curator_notes') as any)
                .update({ content, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single()

            if (error) throw error

            note = {
                id: updated.id,
                content: updated.content,
                isPinned: updated.is_pinned,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at
            }
        } else {
            // Create new note
            const { data: newNote, error } = await (supabase.from('curator_notes') as any)
                .insert({
                    item_id: itemId,
                    user_id: userId,
                    content,
                    is_pinned: true,
                })
                .select()
                .single()

            if (error) throw error

            note = {
                id: newNote.id,
                content: newNote.content,
                isPinned: newNote.is_pinned,
                createdAt: newNote.created_at,
                updatedAt: newNote.updated_at
            }
        }

        revalidatePath('/categories')
        return { success: true, note }
    } catch (error) {
        console.error('Failed to upsert curator note:', error)
        return { success: false, error: 'Failed to save note' }
    }
}

export async function deleteCuratorNote(noteId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    // Verify ownership
    const { data: note } = await (supabase.from('curator_notes') as any)
        .select('user_id')
        .eq('id', noteId)
        .single()

    if (!note) {
        return { success: false, error: 'Note not found' }
    }

    if (note.user_id !== userId) {
        return { success: false, error: 'Not authorized to delete this note' }
    }

    try {
        await (supabase.from('curator_notes') as any).delete().eq('id', noteId)
        revalidatePath('/categories')
        return { success: true }
    } catch (error) {
        console.error('Failed to delete curator note:', error)
        return { success: false, error: 'Failed to delete note' }
    }
}

export async function toggleNotePin(noteId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    const { data: note } = await (supabase.from('curator_notes') as any)
        .select('id, user_id, is_pinned')
        .eq('id', noteId)
        .single()

    if (!note || note.user_id !== userId) {
        return { success: false, error: 'Note not found or not authorized' }
    }

    try {
        await (supabase.from('curator_notes') as any)
            .update({ is_pinned: !note.is_pinned })
            .eq('id', noteId)

        revalidatePath('/categories')
        return { success: true }
    } catch (error) {
        console.error('Failed to toggle note pin:', error)
        return { success: false, error: 'Failed to update note' }
    }
}

export async function getCategoryNotes(categoryId: string): Promise<Map<string, CuratorNote>> {
    const supabase = await createClient()

    const { data: notes, error } = await (supabase.from('curator_notes') as any)
        .select(`
            id,
            item_id,
            content,
            is_pinned,
            created_at,
            updated_at,
            items!inner(category_id)
        `)
        .eq('items.category_id', categoryId)

    if (error) throw error

    const noteMap = new Map<string, CuratorNote>()
    for (const note of notes || []) {
        noteMap.set(note.item_id, {
            id: note.id,
            content: note.content,
            isPinned: note.is_pinned,
            createdAt: note.created_at,
            updatedAt: note.updated_at,
        })
    }

    return noteMap
}
