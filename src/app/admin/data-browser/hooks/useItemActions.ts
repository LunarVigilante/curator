'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import pLimit from 'p-limit'
import type { GlobalItem } from '../types'
import type { useDataBrowserState } from './useDataBrowserState'
import type { useDataFetching } from './useDataFetching'

type BrowserState = ReturnType<typeof useDataBrowserState>
type DataState = ReturnType<typeof useDataFetching>

export function useItemActions(state: BrowserState, data: DataState) {
    const { selection, modals } = state
    const { items, setItems, fetchItems } = data
    const supabase = createClient()

    // Loading states
    const [actionLoading, setActionLoading] = useState(false)
    const [bulkActionProgress, setBulkActionProgress] = useState<{ current: number; total: number; action: string } | null>(null)
    const [regeneratingDescriptionIds, setRegeneratingDescriptionIds] = useState<Set<string>>(new Set())
    const [regeneratingTagIds, setRegeneratingTagIds] = useState<Set<string>>(new Set())
    const [refreshingMetadataIds, setRefreshingMetadataIds] = useState<Set<string>>(new Set())

    // --------------------------------------------------------
    // SINGLE ITEM ACTIONS
    // --------------------------------------------------------

    const handleRegenerate = useCallback(async (item: GlobalItem) => {
        setRegeneratingDescriptionIds(prev => new Set(prev).add(item.id))
        try {
            const response = await fetch('/api/v1/ai/regenerate-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, title: item.title, type: item.category_type })
            })
            if (!response.ok) throw new Error('Failed')
            toast.success(`Regenerated description for ${item.title}`)
            fetchItems()
        } catch (_e) {
            toast.error('Regeneration failed')
        } finally {
            setRegeneratingDescriptionIds(prev => {
                const next = new Set(prev)
                next.delete(item.id)
                return next
            })
        }
    }, [fetchItems])

    const handleGenerateTagsForItem = useCallback(async (item: GlobalItem) => {
        setRegeneratingTagIds(prev => new Set(prev).add(item.id))
        try {
            const { generateTagsAction } = await import('@/lib/actions/ai')
            const { createTagsBatch } = await import('@/lib/actions/tags')

            const data = await generateTagsAction({
                title: item.title,
                type: item.category_type || '',
                description: item.description || ''
            })

            if (data.tags && data.tags.length > 0) {
                const validTags = await createTagsBatch(data.tags)
                await supabase.from('global_items').update({
                    cached_tags: validTags.map(t => ({ id: t.id, name: t.name }))
                }).eq('id', item.id)
                toast.success(`Generated ${validTags.length} tags for ${item.title}`)
                fetchItems()
            }
        } catch (_e) {
            toast.error('Tag generation failed')
        } finally {
            setRegeneratingTagIds(prev => {
                const next = new Set(prev)
                next.delete(item.id)
                return next
            })
        }
    }, [supabase, fetchItems])

    const handleRefreshMetadata = useCallback(async (item: GlobalItem) => {
        setRefreshingMetadataIds(prev => new Set(prev).add(item.id))
        try {
            const response = await fetch('/api/v1/ai/enrich-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: item.id,
                    title: item.title,
                    type: item.category_type || '',
                    force: true
                })
            })
            if (response.ok) {
                toast.success(`Refreshed metadata for ${item.title}`)
                fetchItems()
            } else {
                toast.error('Refresh failed')
            }
        } catch (_e) {
            toast.error('Metadata refresh failed')
        } finally {
            setRefreshingMetadataIds(prev => {
                const next = new Set(prev)
                next.delete(item.id)
                return next
            })
        }
    }, [fetchItems])

    // --------------------------------------------------------
    // BULK ACTIONS
    // --------------------------------------------------------

    const handleBulkDelete = useCallback(async (
        deleteConfirm: { type: 'single' | 'selected' | 'source'; source?: string; id?: string },
        confirmText: string
    ) => {
        if (deleteConfirm.type === 'source' && confirmText !== 'DELETE') return

        setActionLoading(true)
        try {
            if (deleteConfirm.type === 'selected') {
                const { error } = await supabase.from('global_items').delete().in('id', Array.from(selection.selectedIds))
                if (error) throw error
                selection.setSelectedIds(new Set())
                toast.success(`Deleted ${selection.selectedIds.size} items`)
            } else if (deleteConfirm.type === 'single' && deleteConfirm.id) {
                const { error } = await supabase.from('global_items').delete().eq('id', deleteConfirm.id)
                if (error) throw error
                setItems(prev => prev.filter(i => i.id !== deleteConfirm.id))
                toast.success('Item deleted')
            } else if (deleteConfirm.type === 'source' && deleteConfirm.source) {
                // Find all items with this source in external_ids
                const { data: itemsToDelete } = await supabase.from('global_items').select('id, external_ids')
                const idsToDelete = (itemsToDelete as any[])
                    ?.filter(item => item.external_ids && deleteConfirm.source! in item.external_ids)
                    .map(item => item.id) || []

                for (let i = 0; i < idsToDelete.length; i += 1000) {
                    await supabase.from('global_items').delete().in('id', idsToDelete.slice(i, i + 1000))
                }
                toast.success(`Deleted ${idsToDelete.length} items from ${deleteConfirm.source}`)
            }
        } catch (_e) {
            toast.error('Delete failed')
        } finally {
            setActionLoading(false)
        }
    }, [supabase, selection, setItems])

    const handleBulkRegenerateDescriptions = useCallback(async () => {
        if (selection.selectedIds.size === 0) return

        const ids = Array.from(selection.selectedIds)
        const total = ids.length
        const limit = pLimit(5)

        setBulkActionProgress({ current: 0, total, action: 'Regenerating descriptions' })

        let success = 0
        let completed = 0

        const promises = ids.map(id => limit(async () => {
            const item = items.find(it => it.id === id)
            if (!item) {
                completed++
                setBulkActionProgress({ current: completed, total, action: 'Regenerating descriptions' })
                return
            }

            try {
                const response = await fetch('/api/v1/ai/regenerate-description', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId: item.id, title: item.title, type: item.category_type })
                })
                if (response.ok) success++
            } catch (e) {
                console.error('Bulk regen error for', item.title, e)
            } finally {
                completed++
                setBulkActionProgress({ current: completed, total, action: 'Regenerating descriptions' })
            }
        }))

        await Promise.all(promises)

        setBulkActionProgress(null)
        selection.setSelectedIds(new Set())
        fetchItems()
        toast.success(`Regenerated ${success}/${total} descriptions`)
    }, [selection, items, fetchItems])

    const handleBulkRegenerateTags = useCallback(async () => {
        if (selection.selectedIds.size === 0) return

        const ids = Array.from(selection.selectedIds)
        const total = ids.length
        const limit = pLimit(5)

        setBulkActionProgress({ current: 0, total, action: 'Regenerating tags' })

        const { generateTagsAction } = await import('@/lib/actions/ai')
        const { createTagsBatch } = await import('@/lib/actions/tags')

        let success = 0
        let completed = 0

        const promises = ids.map(id => limit(async () => {
            const item = items.find(it => it.id === id)
            if (!item) {
                completed++
                setBulkActionProgress({ current: completed, total, action: 'Regenerating tags' })
                return
            }

            try {
                const data = await generateTagsAction({
                    title: item.title,
                    type: item.category_type || '',
                    description: item.description || ''
                })

                if (data.tags && data.tags.length > 0) {
                    const validTags = await createTagsBatch(data.tags)
                    await supabase.from('global_items').update({
                        cached_tags: validTags.map(t => ({ id: t.id, name: t.name }))
                    }).eq('id', item.id)
                    success++
                }
            } catch (e) {
                console.error('Bulk tag error for', item.title, e)
            } finally {
                completed++
                setBulkActionProgress({ current: completed, total, action: 'Regenerating tags' })
            }
        }))

        await Promise.all(promises)

        setBulkActionProgress(null)
        selection.setSelectedIds(new Set())
        fetchItems()
        toast.success(`Regenerated tags for ${success}/${total} items`)
    }, [selection, items, supabase, fetchItems])

    // --------------------------------------------------------
    // SAVE / CONFIG
    // --------------------------------------------------------

    const handleSaveEdit = useCallback(async (item: GlobalItem, updates: Partial<GlobalItem>) => {
        setActionLoading(true)
        try {
            const { error } = await supabase.from('global_items').update(updates).eq('id', item.id)
            if (error) throw error
            toast.success('Item saved')
        } catch (_e) {
            toast.error('Save failed')
        } finally {
            setActionLoading(false)
        }
    }, [supabase])

    const handleSaveConfig = useCallback(async () => {
        setActionLoading(true)
        try {
            const { error } = await supabase.from('system_settings').upsert({
                key: 'STEAMGRIDDB_API_KEY',
                value: modals.steamGridKey,
                category: 'integrations',
                is_secret: true
            })
            if (error) throw error
            toast.success('Configuration saved')
        } catch (_e) {
            toast.error('Failed to save configuration')
        } finally {
            setActionLoading(false)
        }
    }, [supabase, modals.steamGridKey])

    return {
        // Loading states
        actionLoading,
        bulkActionProgress,
        regeneratingDescriptionIds,
        regeneratingTagIds,
        refreshingMetadataIds,

        // Single item actions
        handleRegenerate,
        handleGenerateTagsForItem,
        handleRefreshMetadata,

        // Bulk actions
        handleBulkDelete,
        handleBulkRegenerateDescriptions,
        handleBulkRegenerateTags,

        // Save/Config
        handleSaveEdit,
        handleSaveConfig
    }
}
