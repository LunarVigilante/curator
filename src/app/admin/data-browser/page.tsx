'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
    Film, Tv, Gamepad2, BookOpen, Music, Mic, Dice5,
    Trash2, Pencil, Sparkles, RefreshCw, ChevronLeft, ChevronRight,
    AlertTriangle, Image as ImageIcon, FileText, Search
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface GlobalItem {
    id: string
    title: string
    description: string | null
    image_url: string | null
    category_type: string
    external_ids: Record<string, any> | null
    metadata: Record<string, any> | null
    created_at: string
}

interface Stats {
    total: number
    byCategory: Record<string, number>
}

// ============================================================================
// SOURCE ICONS
// ============================================================================

const SOURCE_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    tmdb: { icon: Film, color: 'text-blue-400', label: 'TMDB' },
    tmdb_tv: { icon: Tv, color: 'text-purple-400', label: 'TMDB TV' },
    anilist: { icon: Sparkles, color: 'text-pink-400', label: 'AniList' },
    bgg: { icon: Dice5, color: 'text-orange-400', label: 'BGG' },
    rawg: { icon: Gamepad2, color: 'text-green-400', label: 'RAWG' },
    google_books: { icon: BookOpen, color: 'text-yellow-400', label: 'Google Books' },
    spotify_artist: { icon: Music, color: 'text-emerald-400', label: 'Spotify' },
    itunes_podcast: { icon: Mic, color: 'text-red-400', label: 'iTunes' },
}

function getSourceFromItem(item: GlobalItem): string {
    if (!item.external_ids) return 'unknown'
    const keys = Object.keys(item.external_ids)
    return keys[0] || 'unknown'
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DataBrowserPage() {
    const [items, setItems] = useState<GlobalItem[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Stats>({ total: 0, byCategory: {} })

    // Filters
    const [selectedSources, setSelectedSources] = useState<string[]>([])
    const [missingImage, setMissingImage] = useState(false)
    const [shortDesc, setShortDesc] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Pagination
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const pageSize = 50

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Modals
    const [editItem, setEditItem] = useState<GlobalItem | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'selected' | 'source'; source?: string } | null>(null)
    const [actionLoading, setActionLoading] = useState(false)

    const supabase = createClient()

    // ========================================================================
    // DATA FETCHING
    // ========================================================================

    const fetchStats = useCallback(async () => {
        const { count } = await supabase
            .from('global_items')
            .select('*', { count: 'exact', head: true })

        const { data: categories } = await supabase
            .from('global_items')
            .select('category_type')

        const byCategory: Record<string, number> = {}
        categories?.forEach(c => {
            byCategory[c.category_type] = (byCategory[c.category_type] || 0) + 1
        })

        setStats({ total: count || 0, byCategory })
    }, [supabase])

    const fetchItems = useCallback(async () => {
        setLoading(true)

        let query = supabase
            .from('global_items')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)

        // Apply filters
        if (searchQuery) {
            query = query.ilike('title', `%${searchQuery}%`)
        }

        if (missingImage) {
            query = query.is('image_url', null)
        }

        if (shortDesc) {
            query = query.or('description.is.null,description.lt.50')
        }

        // Source filter is tricky with JSONB, we'll filter client-side for now

        const { data, count, error } = await query

        if (error) {
            console.error('Error fetching items:', error)
            setLoading(false)
            return
        }

        let filteredData = data || []

        // Client-side source filtering
        if (selectedSources.length > 0) {
            filteredData = filteredData.filter(item => {
                const source = getSourceFromItem(item)
                return selectedSources.includes(source)
            })
        }

        setItems(filteredData)
        setTotalPages(Math.ceil((count || 0) / pageSize))
        setLoading(false)
    }, [supabase, page, searchQuery, missingImage, shortDesc, selectedSources, pageSize])

    useEffect(() => {
        fetchStats()
        fetchItems()
    }, [fetchStats, fetchItems])

    // ========================================================================
    // ACTIONS
    // ========================================================================

    const handleSelectAll = () => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(items.map(i => i.id)))
        }
    }

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedIds(newSet)
    }

    const handleBulkDelete = async () => {
        if (!deleteConfirm) return
        setActionLoading(true)

        if (deleteConfirm.type === 'selected') {
            const { error } = await supabase
                .from('global_items')
                .delete()
                .in('id', Array.from(selectedIds))

            if (!error) {
                setSelectedIds(new Set())
                fetchItems()
                fetchStats()
            }
        } else if (deleteConfirm.type === 'source' && deleteConfirm.source) {
            // Delete all items with this source in external_ids
            const { data: itemsToDelete } = await supabase
                .from('global_items')
                .select('id, external_ids')

            const idsToDelete = itemsToDelete
                ?.filter(item => item.external_ids && deleteConfirm.source! in item.external_ids)
                .map(item => item.id) || []

            if (idsToDelete.length > 0) {
                await supabase
                    .from('global_items')
                    .delete()
                    .in('id', idsToDelete)

                fetchItems()
                fetchStats()
            }
        }

        setDeleteConfirm(null)
        setActionLoading(false)
    }

    const handleSaveEdit = async () => {
        if (!editItem) return
        setActionLoading(true)

        await supabase
            .from('global_items')
            .update({ title: editTitle, description: editDescription })
            .eq('id', editItem.id)

        setEditItem(null)
        fetchItems()
        setActionLoading(false)
    }

    const handleRegenerate = async (item: GlobalItem) => {
        // Call the AI rewrite action
        try {
            const response = await fetch('/api/ai/regenerate-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, title: item.title, type: item.category_type })
            })

            if (response.ok) {
                fetchItems()
            }
        } catch (error) {
            console.error('Failed to regenerate:', error)
        }
    }

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">Data Browser</h1>
                <p className="text-zinc-400">Manage and curate your content database</p>
            </div>

            {/* Stats Bar */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="text-lg font-semibold">
                        Total Items: <span className="text-cyan-400">{stats.total.toLocaleString()}</span>
                    </div>
                    <div className="h-6 w-px bg-zinc-700" />
                    {Object.entries(stats.byCategory).slice(0, 8).map(([cat, count]) => (
                        <div key={cat} className="text-sm text-zinc-400">
                            {cat}: <span className="text-white">{count.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-6">
                {/* Sidebar Filters */}
                <div className="w-64 flex-shrink-0">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 sticky top-6">
                        <h3 className="font-semibold mb-4 text-zinc-300">Filters</h3>

                        {/* Search */}
                        <div className="mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <Input
                                    placeholder="Search titles..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-zinc-800 border-zinc-700"
                                />
                            </div>
                        </div>

                        {/* Source Filter */}
                        <div className="mb-4">
                            <h4 className="text-sm font-medium text-zinc-400 mb-2">Source</h4>
                            <div className="space-y-2">
                                {Object.entries(SOURCE_ICONS).map(([key, { icon: Icon, color, label }]) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1 rounded">
                                        <Checkbox
                                            checked={selectedSources.includes(key)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedSources([...selectedSources, key])
                                                } else {
                                                    setSelectedSources(selectedSources.filter(s => s !== key))
                                                }
                                            }}
                                        />
                                        <Icon className={`w-4 h-4 ${color}`} />
                                        <span className="text-sm">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Quality Filters */}
                        <div className="mb-4">
                            <h4 className="text-sm font-medium text-zinc-400 mb-2">Quality Issues</h4>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1 rounded">
                                    <Checkbox checked={missingImage} onCheckedChange={(c) => setMissingImage(!!c)} />
                                    <ImageIcon className="w-4 h-4 text-yellow-500" />
                                    <span className="text-sm">Missing Image</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1 rounded">
                                    <Checkbox checked={shortDesc} onCheckedChange={(c) => setShortDesc(!!c)} />
                                    <FileText className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm">Short Description</span>
                                </label>
                            </div>
                        </div>

                        {/* Bulk Delete by Source */}
                        <div className="pt-4 border-t border-zinc-800">
                            <h4 className="text-sm font-medium text-zinc-400 mb-2">Danger Zone</h4>
                            <div className="space-y-2">
                                {Object.entries(SOURCE_ICONS).map(([key, { label }]) => (
                                    <Button
                                        key={key}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30"
                                        onClick={() => setDeleteConfirm({ type: 'source', source: key })}
                                    >
                                        <Trash2 className="w-3 h-3 mr-2" />
                                        Delete all {label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1">
                    {/* Actions Bar */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Checkbox
                                checked={selectedIds.size === items.length && items.length > 0}
                                onCheckedChange={handleSelectAll}
                            />
                            <span className="text-sm text-zinc-400">
                                {selectedIds.size} selected
                            </span>
                            {selectedIds.size > 0 && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setDeleteConfirm({ type: 'selected' })}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Selected
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { fetchItems(); fetchStats(); }}
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Items Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <RefreshCw className="w-8 h-8 animate-spin text-zinc-500" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {items.map(item => {
                                const source = getSourceFromItem(item)
                                const sourceInfo = SOURCE_ICONS[source]
                                const SourceIcon = sourceInfo?.icon || Film

                                return (
                                    <Card
                                        key={item.id}
                                        className={`bg-zinc-900/50 border-zinc-800 overflow-hidden cursor-pointer transition-all hover:border-zinc-600 ${selectedIds.has(item.id) ? 'ring-2 ring-cyan-500' : ''}`}
                                    >
                                        <div className="relative aspect-[2/3]">
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                                    <ImageIcon className="w-8 h-8 text-zinc-600" />
                                                </div>
                                            )}

                                            {/* Select checkbox */}
                                            <div className="absolute top-2 left-2">
                                                <Checkbox
                                                    checked={selectedIds.has(item.id)}
                                                    onCheckedChange={() => toggleSelect(item.id)}
                                                    className="bg-black/50 border-white/50"
                                                />
                                            </div>

                                            {/* Source badge */}
                                            <Badge className={`absolute top-2 right-2 ${sourceInfo?.color || 'text-white'} bg-black/70 border-0`}>
                                                <SourceIcon className="w-3 h-3" />
                                            </Badge>

                                            {/* Action buttons on hover */}
                                            <div className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditItem(item)
                                                        setEditTitle(item.title)
                                                        setEditDescription(item.description || '')
                                                    }}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleRegenerate(item)
                                                    }}
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <CardContent className="p-3">
                                            <h4 className="font-medium text-sm truncate">{item.title}</h4>
                                            <p className="text-xs text-zinc-500 line-clamp-2 mt-1">
                                                {item.description || 'No description'}
                                            </p>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="flex items-center justify-center gap-4 mt-6">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-zinc-400">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800">
                    <DialogHeader>
                        <DialogTitle>Edit Item</DialogTitle>
                        <DialogDescription>Update the title and description</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="mt-1 bg-zinc-800 border-zinc-700"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <Textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                rows={6}
                                className="mt-1 bg-zinc-800 border-zinc-700"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditItem(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={actionLoading}>
                            {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-400">
                            <AlertTriangle className="w-5 h-5" />
                            Confirm Deletion
                        </DialogTitle>
                        <DialogDescription>
                            {deleteConfirm?.type === 'selected'
                                ? `Are you sure you want to delete ${selectedIds.size} selected items?`
                                : `Are you sure you want to delete ALL items from ${SOURCE_ICONS[deleteConfirm?.source || '']?.label || deleteConfirm?.source}? This cannot be undone.`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleBulkDelete} disabled={actionLoading}>
                            {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
