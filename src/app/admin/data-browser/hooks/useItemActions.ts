'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { GlobalItem } from '../types'
import type { useDataBrowserState } from './useDataBrowserState'

type BrowserState = ReturnType<typeof useDataBrowserState>

interface ItemActionsProps {
    state: BrowserState
    refreshItems: () => Promise<void>
    onItemsDeleted: (ids: string[]) => void
}

export function useItemActions({ state, refreshItems, onItemsDeleted }: ItemActionsProps) {
    const { selection, modals } = state
    const supabase = createClient()

    // --------------------------------------------------------
    // DELETE
    // --------------------------------------------------------
    const handleDelete = useCallback(async (id: string) => {
        try {
            const { error } = await supabase.from('global_items').delete().eq('id', id)
            if (error) throw error

            toast.success('Item deleted')
            onItemsDeleted([id])

            // If viewing details of deleted item, close it
            if (modals.viewItem?.id === id) {
                modals.setViewItem(null)
            }
        } catch (err: any) {
            console.error('Delete error:', err)
            toast.error('Failed to delete item')
        }
    }, [supabase, modals, onItemsDeleted])

    const handleBulkDelete = useCallback(async () => {
        if (selection.selectedIds.size === 0) return

        try {
            const ids = Array.from(selection.selectedIds)
            const { error } = await supabase.from('global_items').delete().in('id', ids)

            if (error) throw error

            toast.success(`Deleted ${ids.length} items`)
            onItemsDeleted(ids)
            selection.setSelectedIds(new Set())
            modals.setDeleteConfirm(null)
        } catch (err: any) {
            console.error('Bulk delete error:', err)
            toast.error('Failed to delete items')
        }
    }, [supabase, selection, modals, onItemsDeleted])

    const handleDeleteSource = useCallback(async (source: string) => {
        try {
            // Note: This matches the original logic which likely relies on strict source string matching
            const { error } = await supabase.from('global_items').delete().eq('source', source)

            if (error) throw error

            toast.success(`Deleted all items from ${source}`)
            refreshItems() // Full refresh needed for bulk source delete
            modals.setDeleteConfirm(null)
        } catch (err: any) {
            console.error('Source delete error:', err)
            toast.error('Failed to delete items from source')
        }
    }, [supabase, refreshItems, modals])

    // --------------------------------------------------------
    // ANALYZE / UPDATE
    // --------------------------------------------------------
    const handleAnalyze = useCallback(async () => {
        if (selection.selectedIds.size === 0) return

        const loadingToast = toast.loading(`Analyzing ${selection.selectedIds.size} items...`)

        try {
            const ids = Array.from(selection.selectedIds)

            // Call API endpoint
            const response = await fetch('/api/ai/enrich-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemIds: ids })
            })

            if (!response.ok) {
                throw new Error('Analysis failed')
            }

            const result = await response.json()
            toast.success(`Analysis complete: ${result.updated} updated`)
            selection.setSelectedIds(new Set())
            refreshItems()
        } catch (err: any) {
            console.error('Analysis error:', err)
            toast.error('Analysis failed: ' + err.message)
        } finally {
            toast.dismiss(loadingToast)
        }
    }, [selection, refreshItems])

    const handleRefreshMetadata = useCallback(async (item: GlobalItem) => {
        const loadingToast = toast.loading(`Refreshing ${item.title}...`)
        try {
            const response = await fetch('/api/ai/enrich-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: item.id,
                    title: item.title,
                    type: item.category_type,
                    force: true
                })
            })

            if (!response.ok) throw new Error('Refresh failed')

            toast.success(`Refreshed ${item.title}`)
            refreshItems()
        } catch (err: any) {
            console.error('Refresh error:', err)
            toast.error('Refresh failed')
        } finally {
            toast.dismiss(loadingToast)
        }
    }, [refreshItems])

    const handleRegenerateDescription = useCallback(async (item: GlobalItem) => {
        const loadingToast = toast.loading(`Regenerating description for ${item.title}...`)
        try {
            const response = await fetch('/api/ai/regenerate-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: item.id,
                    title: item.title,
                    type: item.category_type
                })
            })

            if (!response.ok) throw new Error('Regeneration failed')

            toast.success(`Regenerated description for ${item.title}`)
            refreshItems()
        } catch (err: any) {
            console.error('Regeneration error:', err)
            toast.error('Regeneration failed')
        } finally {
            toast.dismiss(loadingToast)
        }
    }, [refreshItems])

    const handleGenerateTags = useCallback(async (item: GlobalItem) => {
        const loadingToast = toast.loading(`Generating tags for ${item.title}...`)
        try {
            const response = await fetch('/api/ai/generate-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: item.id,
                    title: item.title,
                    type: item.category_type
                })
            })

            if (!response.ok) throw new Error('Tag generation failed')

            toast.success(`Generated tags for ${item.title}`)
            refreshItems()
        } catch (err: any) {
            console.error('Tag error:', err)
            toast.error('Tag generation failed')
        } finally {
            toast.dismiss(loadingToast)
        }
    }, [refreshItems])

    // --------------------------------------------------------
    // ADD / EDIT
    // --------------------------------------------------------
    const handleSaveItem = useCallback(async (item: Partial<GlobalItem>) => {
        try {
            if (modals.editMode === 'edit' && item.id) {
                const { error } = await (supabase
                    .from('global_items') as any)
                    .update(item)
                    .eq('id', item.id)

                if (error) throw error
                toast.success('Item updated')
            } else {
                // Remove ID for creation to let DB generate it (if using UUID) or ensure it's provided
                const { id, ...newItem } = item
                const { error } = await (supabase
                    .from('global_items') as any)
                    .insert([newItem])

                if (error) throw error
                toast.success('Item created')
            }

            modals.setEditItem(null)
            refreshItems()
        } catch (err: any) {
            console.error('Save error:', err)
            toast.error('Failed to save item')
        }
    }, [supabase, modals, refreshItems])

    return {
        handleDelete,
        handleBulkDelete,
        handleDeleteSource,
        handleAnalyze,
        handleRefreshMetadata,
        handleRegenerateDescription,
        handleGenerateTags,
        handleSaveItem
    }
}
