'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
    AlertTriangle, Image as ImageIcon, FileText, Search, ShieldAlert, LayoutGrid, X, Save,
    Loader2, Wand2, Crop, Check, Key, Settings
} from 'lucide-react'
import TagSelector from '@/components/tags/TagSelector'
import ImageCropper from '@/components/ImageCropper'
import { toast } from 'sonner'
import Image from 'next/image'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CATEGORY_LABELS, normalizeCategory, formatCategoryLabel, CATEGORY_TYPES } from '@/lib/constants'
import ItemDetailView from '@/components/item-details/ItemDetailView'

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
    cached_tags: { id: string, name: string }[] | null
}

interface Stats {
    total: number
    byCategory: Record<string, number>
}

// ============================================================================
// HELPERS & CONFIG
// ============================================================================

const CATEGORY_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    [CATEGORY_TYPES.MOVIE]: { icon: Film, color: 'text-blue-400', label: 'Movies' },
    [CATEGORY_TYPES.TV_SHOW]: { icon: Tv, color: 'text-purple-400', label: 'TV Shows' },
    [CATEGORY_TYPES.ANIME]: { icon: Sparkles, color: 'text-pink-400', label: 'Anime' },
    [CATEGORY_TYPES.BOARD_GAME]: { icon: Dice5, color: 'text-orange-400', label: 'Board Games' },
    [CATEGORY_TYPES.VIDEO_GAME]: { icon: Gamepad2, color: 'text-green-400', label: 'Video Games' },
    [CATEGORY_TYPES.BOOKS]: { icon: BookOpen, color: 'text-yellow-400', label: 'Books' },
    [CATEGORY_TYPES.MUSIC_ARTIST]: { icon: Music, color: 'text-emerald-400', label: 'Music' },
    [CATEGORY_TYPES.PODCAST]: { icon: Mic, color: 'text-red-400', label: 'Podcasts' },
}


function getSourceFromItem(item: GlobalItem): string {
    if (!item.external_ids) return 'unknown'
    const keys = Object.keys(item.external_ids)
    return keys[0] || 'unknown'
}

// Helper to safely parse cached_tags which may be in different formats due to migration
function parseCachedTags(cached_tags: any): { id: string; name: string }[] {
    if (!cached_tags) return []

    // If it's a string, try to parse it
    let parsed = cached_tags
    if (typeof cached_tags === 'string') {
        try {
            parsed = JSON.parse(cached_tags)
        } catch {
            return []
        }
    }

    if (!Array.isArray(parsed)) return []

    // Handle array of strings (old format) vs array of {id, name} objects (new format)
    return parsed.map((tag: any, index: number) => {
        if (typeof tag === 'string') {
            return { id: `temp-${index}`, name: tag }
        }
        if (tag && typeof tag === 'object' && tag.name) {
            return { id: tag.id || `temp-${index}`, name: tag.name }
        }
        return null
    }).filter((t): t is { id: string; name: string } => t !== null)
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DataBrowserPage() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const [items, setItems] = useState<GlobalItem[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Stats>({ total: 0, byCategory: {} })

    // URL-based filters (from FilterPill clicks)
    const activeFilters = useMemo(() => {
        const filters: Record<string, string> = {}
        const filterKeys = ['director', 'cast', 'studio', 'genre', 'tag', 'developer', 'platform', 'designer', 'mechanic', 'artist', 'content_rating', 'year', 'category']
        filterKeys.forEach(key => {
            const value = searchParams.get(key)
            if (value) filters[key] = value
        })
        return filters
    }, [searchParams])

    const hasActiveFilters = Object.keys(activeFilters).length > 0

    const removeFilter = (key: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete(key)
        router.push(`/admin/data-browser?${params.toString()}`)
    }

    const clearAllFilters = () => {
        router.push('/admin/data-browser')
    }

    // Filters
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [missingImage, setMissingImage] = useState(false)
    const [shortDesc, setShortDesc] = useState(false)
    const [uncategorized, setUncategorized] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // UI State
    const [tileSize, setTileSize] = useState(50) // 0-100 scale for slider
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const pageSize = 50

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Modals
    // Modals
    const [editItem, setEditItem] = useState<GlobalItem | null>(null)
    const [editCategoryType, setEditCategoryType] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')

    const [editDescription, setEditDescription] = useState('')
    const [editImage, setEditImage] = useState('')
    const [editTags, setEditTags] = useState<string[]>([])
    const [editMetadata, setEditMetadata] = useState('')
    const [imageUploadMode, setImageUploadMode] = useState<'url' | 'upload'>('url')
    const [mediaResults, setMediaResults] = useState<any[]>([])
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
    const [isGeneratingTags, setIsGeneratingTags] = useState(false)
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [editMode, setEditMode] = useState<'view' | 'edit'>('view')

    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'selected' | 'source'; source?: string; id?: string } | null>(null)
    const [maintenanceOpen, setMaintenanceOpen] = useState(false)
    const [steamGridKey, setSteamGridKey] = useState('')
    const [confirmText, setConfirmText] = useState('')
    const [actionLoading, setActionLoading] = useState(false)

    const supabase = createClient()

    // Fetch config on mount/open
    useEffect(() => {
        if (maintenanceOpen) {
            const fetchConfig = async () => {
                const { data } = await (supabase
                    .from('system_settings') as any)
                    .select('value')
                    .eq('key', 'STEAMGRIDDB_API_KEY')
                    .single()
                if (data) setSteamGridKey(data.value)
            }
            fetchConfig()
        }
    }, [maintenanceOpen, supabase])

    const handleSaveConfig = async () => {
        setActionLoading(true)
        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'STEAMGRIDDB_API_KEY',
                    value: steamGridKey,
                    category: 'integrations',
                    is_secret: true
                } as any)

            if (error) throw error
            toast.success('Configuration saved')
        } catch (error) {
            console.error('Failed to save config:', error)
            toast.error('Failed to save configuration')
        } finally {
            setActionLoading(false)
        }
    }

    // ========================================================================
    // DATA FETCHING
    // ========================================================================

    const fetchStats = useCallback(async () => {
        const { count } = await supabase
            .from('global_items')
            .select('*', { count: 'exact', head: true })

        const { data: catStats } = await (supabase.rpc('get_category_stats') as any)

        // Group by normalized category to merge variations
        const byCategory: Record<string, number> = {}

        if (catStats) {
            catStats.forEach((item: any) => {
                const key = normalizeCategory(item.category)
                byCategory[key] = (byCategory[key] || 0) + item.count
            })
        }

        setStats({ total: count || 0, byCategory })
    }, [supabase])

    const fetchItems = useCallback(async () => {
        setLoading(true)

        // Base Query
        let query = supabase
            .from('global_items')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1)

        // Text Search
        if (searchQuery) {
            const fuzzyQuery = searchQuery
                .split(/[\s\-_:,.]+/)
                .filter(Boolean)
                .join('%')
            query = query.ilike('title', `%${fuzzyQuery}%`)
        }

        // URL-based filters (from FilterPill clicks)
        // Exact match filters
        if (activeFilters.director) {
            query = query.eq('director', activeFilters.director)
        }
        if (activeFilters.studio) {
            query = query.eq('studio', activeFilters.studio)
        }
        if (activeFilters.content_rating) {
            query = query.eq('content_rating', activeFilters.content_rating)
        }
        if (activeFilters.year) {
            query = query.eq('release_year', parseInt(activeFilters.year))
        }
        if (activeFilters.category) {
            query = query.eq('category_type', activeFilters.category.toUpperCase().replace(/-/g, '_'))
        }

        // Array contains filters (cast, genres, platforms, etc.)
        if (activeFilters.cast) {
            query = query.contains('cast', [activeFilters.cast])
        }
        if (activeFilters.genre) {
            query = query.contains('genres', [activeFilters.genre])
        }
        if (activeFilters.developer) {
            query = query.or(`studio.eq.${activeFilters.developer},developers.cs.{${activeFilters.developer}}`)
        }
        if (activeFilters.platform) {
            query = query.contains('platforms', [activeFilters.platform])
        }
        if (activeFilters.designer) {
            query = query.contains('designers', [activeFilters.designer])
        }
        if (activeFilters.mechanic) {
            query = query.contains('mechanics', [activeFilters.mechanic])
        }
        if (activeFilters.artist) {
            query = query.contains('artists', [activeFilters.artist])
        }
        // Tag filter - search in cached_tags JSONB
        if (activeFilters.tag) {
            query = query.contains('cached_tags', [{ name: activeFilters.tag }])
        }

        // Build OR conditions for quality filters
        const orConditions: string[] = []

        // Category Filter (AND logic - restricts scope)
        if (selectedCategories.length > 0) {
            query = query.in('category_type', selectedCategories)
        }

        // Quality Filters (OR logic - match ANY)
        if (missingImage) {
            orConditions.push('image_url.is.null')
        }

        if (shortDesc) {
            orConditions.push('description.is.null', 'description_length.lt.50')
        }

        if (uncategorized) {
            orConditions.push('category_type.is.null', 'category_type.eq.null', 'category_type.eq.NULL')
        }

        // Apply combined OR filter for quality issues
        if (orConditions.length > 0) {
            query = query.or(orConditions.join(','))
        }

        const { data, count, error } = await query

        if (error) {
            console.error('Error fetching items:', error)
            setLoading(false)
            return
        }

        setItems(data || [])
        setTotalPages(Math.ceil((count || 0) / pageSize))
        setTotalCount(count || 0)
        setLoading(false)
    }, [supabase, page, searchQuery, missingImage, shortDesc, uncategorized, selectedCategories, pageSize, activeFilters])

    useEffect(() => {
        fetchStats()
        fetchItems()
    }, [fetchStats, fetchItems])

    // Select visible items
    useEffect(() => {
        // Reset selection when page/items change if desired, or keep cross-page selection?
        // Let's keep selection but make "Select All" only select visible items
    }, [items])

    // ========================================================================
    // ACTIONS
    // ========================================================================

    const handleSelectVisible = () => {
        const visibleIds = items.map(i => i.id)
        const allSelected = visibleIds.every(id => selectedIds.has(id))

        const newSet = new Set(selectedIds)
        if (allSelected) {
            visibleIds.forEach(id => newSet.delete(id))
        } else {
            visibleIds.forEach(id => newSet.add(id))
        }
        setSelectedIds(newSet)
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

        // Double confirmation for source delete
        if (deleteConfirm.type === 'source' && confirmText !== 'DELETE') {
            return
        }

        setActionLoading(true)

        if (deleteConfirm.type === 'selected') {
            const { error } = await (supabase
                .from('global_items') as any)
                .delete()
                .in('id', Array.from(selectedIds))

            if (!error) {
                setSelectedIds(new Set())
                fetchItems()
                fetchStats()
            }
        } else if (deleteConfirm.type === 'single' && deleteConfirm.id) {
            const { error } = await (supabase
                .from('global_items') as any)
                .delete()
                .eq('id', deleteConfirm.id)

            if (!error) {
                // Remove from local items immediately
                setItems(items => items.filter(i => i.id !== deleteConfirm.id))
                toast.success('Item deleted')
                setEditItem(null) // Close modal if open
                fetchStats()
            } else {
                toast.error('Failed to delete item')
            }
        } else if (deleteConfirm.type === 'source' && deleteConfirm.source) {
            const { data: itemsToDelete } = await (supabase
                .from('global_items') as any)
                .select('id, external_ids')

            const idsToDelete = (itemsToDelete as any[])
                ?.filter(item => item.external_ids && deleteConfirm.source! in item.external_ids)
                .map(item => item.id) || []

            if (idsToDelete.length > 0) {
                // Batch delete in chunks of 1000 to avoid request limits
                for (let i = 0; i < idsToDelete.length; i += 1000) {
                    await (supabase
                        .from('global_items') as any)
                        .delete()
                        .in('id', idsToDelete.slice(i, i + 1000))
                }

                fetchItems()
                fetchStats()
            }
        }

        setDeleteConfirm(null)
        setMaintenanceOpen(false)
        setConfirmText('')
        setActionLoading(false)
    }
    const doSearch = async (searchTerm: string) => {
        if (!searchTerm || searchTerm.length < 2) return

        const { searchMediaAction } = await import('@/lib/actions/media')

        // Use editItem type or category filter if available
        const type = editCategoryType || editItem?.category_type || 'general'

        const response = await searchMediaAction(searchTerm, type, null, undefined)

        if (response.success) {
            setMediaResults(response.data)
        } else {
            toast.error('Search failed')
        }
    }

    const handleMetadataMatch = async (result: any) => {
        // Update fields immediately
        setEditTitle(result.title)
        setEditImage(result.imageUrl || editImage)
        setImageUploadMode(result.imageUrl ? 'url' : imageUploadMode)
        setEditDescription('✨ Generating AI curated description...')
        setEditTags([]) // Clear tags

        // Store external ID and other metadata
        const newMetadata = {
            ...(typeof editItem?.metadata === 'object' ? editItem.metadata : {}),
            external_ids: { ...editItem?.external_ids, [result.source || 'tmdb']: result.id },
            release_year: result.year
        }
        setEditMetadata(JSON.stringify(newMetadata))

        setMediaResults([])

        // Trigger AI
        setIsGeneratingDescription(true)
        setIsGeneratingTags(true)

        const { generateDescriptionAction, generateTagsAction } = await import('@/lib/actions/ai')
        const type = editCategoryType || editItem?.category_type || 'general'

        // Description
        generateDescriptionAction({
            title: result.title,
            type: type,
            context: result.description
        }).then(data => {
            if (data.description) setEditDescription(data.description)
        }).finally(() => setIsGeneratingDescription(false))

        // Tags
        generateTagsAction({
            title: result.title,
            type: type,
            description: result.description
        }).then(async data => {
            if (data.tags && data.tags.length > 0) {
                const { createTagsBatch } = await import('@/lib/actions/tags')
                const validTags = await createTagsBatch(data.tags)
                setEditTags(validTags.map(t => t.id))
                toast.success(`Generated ${validTags.length} tags`)
            }
        }).finally(() => setIsGeneratingTags(false))
    }

    const handleAutoFill = async () => {
        if (!editTitle) return
        setIsGeneratingDescription(true)
        try {
            const { generateDescription } = await import('@/lib/actions/ai')
            const description = await generateDescription(editTitle, editCategoryType || editItem?.category_type || '')
            if (description) setEditDescription(description)
        } finally {
            setIsGeneratingDescription(false)
        }
    }

    const handleAutoTag = async () => {
        if (!editTitle) return
        setIsGeneratingTags(true)
        try {
            const { generateTags } = await import('@/lib/actions/ai')
            // generateTags already creates tags in DB and returns { id, name }[]
            const tags = await generateTags(editTitle, editDescription, editCategoryType || editItem?.category_type || '')
            if (tags.length > 0) {
                // Tags are already created, just add their IDs to the state
                const newIds = tags.map((t: { id: string; name: string }) => t.id)
                setEditTags(prev => Array.from(new Set([...prev, ...newIds])))
                toast.success(`Generated ${tags.length} tags`)
            } else {
                toast.error('No tags generated')
            }
        } catch (error) {
            console.error('Auto-tag error:', error)
            toast.error('Failed to generate tags')
        } finally {
            setIsGeneratingTags(false)
        }
    }

    const handleSaveEdit = async () => {
        if (!editItem) return
        setActionLoading(true)

        // Resolve tags to objects for cache
        let resolvedTags: { id: string; name: string }[] = []
        if (editTags.length > 0) {
            const { data } = await supabase.from('tags').select('id, name').in('id', editTags)
            resolvedTags = data || []
        }

        await (supabase
            .from('global_items') as any)
            .update({
                title: editTitle,
                description: editDescription,
                image_url: editImage,
                metadata: editMetadata ? JSON.parse(editMetadata) : editItem.metadata,
                cached_tags: resolvedTags,
                category_type: editCategoryType
            })
            .eq('id', editItem.id)

        setEditItem(null)
        fetchItems()
        setActionLoading(false)
    }

    const handleRegenerate = async (item: GlobalItem) => {
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

    const handleGenerateTagsForItem = async (item: GlobalItem) => {
        const { generateTagsAction } = await import('@/lib/actions/ai')
        toast.promise(async () => {
            const data = await generateTagsAction({
                title: item.title,
                type: item.category_type,
                description: item.description || ''
            })
            if (data.tags && data.tags.length > 0) {
                const { createTagsBatch } = await import('@/lib/actions/tags')
                const validTags = await createTagsBatch(data.tags)
                // Save to item
                await (supabase.from('global_items') as any).update({
                    cached_tags: validTags.map(t => ({ id: t.id, name: t.name }))
                }).eq('id', item.id)
                fetchItems()
                return `Generated ${validTags.length} tags`
            }
            throw new Error('No tags generated')
        }, {
            loading: 'Generating tags...',
            success: (msg: any) => msg,
            error: 'Failed to generate tags'
        })
    }

    // ========================================================================
    // RENDER HELPERS
    // ========================================================================

    const getGridCols = () => {
        // Map 0-100 slider value to grid columns
        // 0 = smallest (most columns), 100 = largest (fewest columns)
        if (tileSize <= 15) return 'grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12'
        if (tileSize <= 30) return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
        if (tileSize <= 50) return 'grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8'
        if (tileSize <= 70) return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
        if (tileSize <= 85) return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    }

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <div className="min-h-screen text-white p-6 font-sans selection:bg-cyan-500/30">

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-white mb-2">Data Browser</h1>
                    <p className="text-zinc-400">Manage and curate your content database</p>
                </div>

                <div className="flex items-center gap-3">
                    <LayoutGrid className="w-4 h-4 text-zinc-400" />
                    <Slider
                        value={[tileSize]}
                        onValueChange={(v) => setTileSize(v[0])}
                        min={0}
                        max={100}
                        step={5}
                        className="w-32"
                    />
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4 mb-6 backdrop-blur-md">
                <div className="flex flex-wrap gap-6 items-center">
                    <div className="text-lg font-semibold">
                        Total Items: <span className="text-cyan-400">{stats.total.toLocaleString()}</span>
                    </div>
                    <div className="h-6 w-px bg-zinc-800" />
                    {Object.entries(stats.byCategory)
                        .sort((a, b) => {
                            // Push 'null' (Uncategorized) to the end
                            if (a[0] === 'null') return 1
                            if (b[0] === 'null') return -1
                            // Then sort by count descending
                            return b[1] - a[1]
                        })
                        .slice(0, 12)
                        .map(([cat, count]) => {
                            const label = formatCategoryLabel(cat)
                            const isNull = cat === 'null'
                            return (
                                <div key={cat} className="text-sm text-zinc-400 flex items-center gap-1.5">
                                    <span className={isNull ? "text-red-400 font-medium" : "text-zinc-300"}>
                                        {label}:
                                    </span>
                                    <span className="text-white font-mono">{count.toLocaleString()}</span>
                                </div>
                            )
                        })}
                </div>
            </div>

            {/* Active Filters Bar */}
            {hasActiveFilters && (
                <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-red-300 font-medium mr-2">Active Filters:</span>
                    {Object.entries(activeFilters).map(([key, value]) => (
                        <Badge
                            key={key}
                            className="bg-red-900/50 text-red-200 border-red-800 cursor-pointer hover:bg-red-800/50 transition-colors"
                            onClick={() => removeFilter(key)}
                        >
                            <span className="text-red-400 mr-1 capitalize">{key.replace(/_/g, ' ')}:</span>
                            {value}
                            <X className="w-3 h-3 ml-1.5" />
                        </Badge>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/30 ml-auto"
                    >
                        Clear All
                    </Button>
                </div>
            )}

            <div className="flex gap-6 items-start">
                {/* Sidebar Filters */}
                <div className="w-64 flex-shrink-0 sticky top-6">
                    <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4 backdrop-blur-md">
                        <h3 className="font-semibold mb-4 text-zinc-300">Filters</h3>

                        {/* Search */}
                        <div className="mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <Input
                                    placeholder="Search titles..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-zinc-900/50 border-zinc-700"
                                />
                            </div>
                        </div>

                        {/* Category Filter */}
                        <div className="mb-4">
                            <h4 className="text-sm font-medium text-zinc-400 mb-2">Category</h4>
                            <div className="space-y-1.5">
                                {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, color, label }]) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1.5 rounded transition-colors">
                                        <Checkbox
                                            checked={selectedCategories.includes(key)}
                                            onCheckedChange={(checked) => {
                                                if (checked) setSelectedCategories([...selectedCategories, key])
                                                else setSelectedCategories(selectedCategories.filter(s => s !== key))
                                            }}
                                            className="data-[state=checked]:bg-zinc-700 data-[state=checked]:text-white border-zinc-600"
                                        />
                                        <Icon className={`w-4 h-4 ${color}`} />
                                        <span className="text-sm text-zinc-300">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Quality Filters */}
                        <div className="mb-4">
                            <h4 className="text-sm font-medium text-zinc-400 mb-2">Quality Issues</h4>
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1.5 rounded transition-colors">
                                    <Checkbox checked={missingImage} onCheckedChange={(c) => setMissingImage(!!c)} className="border-zinc-600" />
                                    <ImageIcon className="w-4 h-4 text-yellow-500" />
                                    <span className="text-sm text-zinc-300">Missing Image</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1.5 rounded transition-colors">
                                    <Checkbox checked={shortDesc} onCheckedChange={(c) => setShortDesc(!!c)} className="border-zinc-600" />
                                    <FileText className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm text-zinc-300">Short Description</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1.5 rounded transition-colors">
                                    <Checkbox checked={uncategorized} onCheckedChange={(c) => setUncategorized(!!c)} className="border-zinc-600" />
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                    <span className="text-sm text-zinc-300">Uncategorized</span>
                                </label>
                            </div>
                        </div>

                        {/* Maintenance Button */}
                        <div className="pt-4 border-t border-zinc-800 mt-4">
                            <Button
                                variant="outline"
                                className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800 border-zinc-700"
                                onClick={() => setMaintenanceOpen(true)}
                            >
                                <ShieldAlert className="w-4 h-4 mr-2" />
                                Database Maintenance
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1">
                    {/* Actions Bar */}
                    <div className="flex items-center justify-between mb-4 bg-zinc-900/30 p-2 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-4 pl-2">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={items.length > 0 && items.every(i => selectedIds.has(i.id))}
                                    onCheckedChange={handleSelectVisible}
                                    className="border-zinc-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
                                />
                                <span className="text-sm text-zinc-400">
                                    {selectedIds.size} selected
                                </span>
                                <span className="text-xs text-zinc-600">•</span>
                                <span className="text-xs text-zinc-500">
                                    {items.length} on page / {totalCount.toLocaleString()} total
                                </span>
                            </div>

                            {selectedIds.size > 0 && (
                                <>
                                    <div className="h-4 w-px bg-zinc-700" />
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setDeleteConfirm({ type: 'selected' })}
                                        className="h-8 text-xs"
                                    >
                                        <Trash2 className="w-3 h-3 mr-2" />
                                        Delete Selected
                                    </Button>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { fetchItems(); fetchStats(); }}
                                className="h-8 text-zinc-400 hover:text-white"
                            >
                                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Items Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="flex flex-col items-center gap-2">
                                <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
                                <p className="text-zinc-500 text-sm">Loading items...</p>
                            </div>
                        </div>
                    ) : (
                        <div className={`grid gap-4 ${getGridCols()}`}>
                            {items.map(item => {
                                const catInfo = CATEGORY_ICONS[item.category_type]
                                const CategoryIcon = catInfo?.icon || Film

                                return (
                                    <Card
                                        key={item.id}
                                        className={`group bg-zinc-900/40 border-zinc-800/50 overflow-hidden cursor-pointer transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-cyan-900/10 ${selectedIds.has(item.id) ? 'ring-2 ring-cyan-500 border-transparent' : ''}`}
                                    >
                                        <div className="relative aspect-[2/3] bg-zinc-900">
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 p-4 text-center">
                                                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                                    <span className="text-xs">No Image</span>
                                                </div>
                                            )}

                                            {/* Overlays */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                                            {/* Selection Checkbox (always visible if selected, or on hover) */}
                                            <div className={`absolute top-2 left-2 transition-opacity duration-200 ${selectedIds.has(item.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                <Checkbox
                                                    checked={selectedIds.has(item.id)}
                                                    onCheckedChange={() => toggleSelect(item.id)}
                                                    className="bg-black/50 border-white/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                                                />
                                            </div>

                                            {/* Source Badge - shows warning if uncategorized */}
                                            {(!item.category_type || item.category_type === 'null' || item.category_type === 'NULL') ? (
                                                <Badge className="absolute top-2 right-2 text-amber-400 bg-black/80 backdrop-blur-sm border-0 shadow-sm px-1.5 py-0.5 h-6">
                                                    <AlertTriangle className="w-3.5 h-3.5" />
                                                </Badge>
                                            ) : (
                                                <Badge className={`absolute top-2 right-2 ${catInfo?.color || 'text-white'} bg-black/80 backdrop-blur-sm border-0 shadow-sm px-1.5 py-0.5 h-6`}>
                                                    <CategoryIcon className="w-3.5 h-3.5" />
                                                </Badge>
                                            )}

                                            {/* Hover Actions */}
                                            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditItem(item)
                                                        setEditCategoryType(item.category_type)
                                                        setEditTitle(item.title)
                                                        setEditDescription(item.description || '')
                                                        setEditImage(item.image_url || '')
                                                        setEditTags(parseCachedTags(item.cached_tags).map(t => t.id))
                                                        setEditMetadata(item.metadata ? JSON.stringify(item.metadata) : '')
                                                    }}
                                                    title="Quick Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleRegenerate(item)
                                                    }}
                                                    title="Regenerate Description"
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleGenerateTagsForItem(item)
                                                    }}
                                                    title="Generate Tags"
                                                >
                                                    <Wand2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="h-8 w-8 rounded-full bg-white/10 hover:bg-red-500/50 text-white border-0 backdrop-blur-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setDeleteConfirm({ type: 'single', id: item.id })
                                                    }}
                                                    title="Delete Item"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            {/* Title Overlay */}
                                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                                <h4 className="font-medium text-sm text-white leading-tight line-clamp-2 drop-shadow-md">{item.title}</h4>
                                            </div>
                                        </div>

                                        {/* Description Footer */}
                                        <CardContent className="p-3 bg-zinc-900">
                                            <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed">
                                                {item.description || <span className="italic opacity-50">No description available.</span>}
                                            </p>
                                            {/* Tags Display */}
                                            {(() => {
                                                const tags = parseCachedTags(item.cached_tags)
                                                return tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {tags.slice(0, 3).map(tag => (
                                                            <Badge key={tag.id} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-zinc-800 text-zinc-400 border-0">
                                                                {tag.name}
                                                            </Badge>
                                                        ))}
                                                        {tags.length > 3 && (
                                                            <span className="text-[9px] text-zinc-500 self-center">+{tags.length - 3}</span>
                                                        )}
                                                    </div>
                                                )
                                            })()}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="flex items-center justify-center gap-4 mt-8 pb-8">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="bg-black border-zinc-700"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Previous
                        </Button>
                        <span className="text-sm text-zinc-400 font-mono">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="bg-black border-zinc-700"
                        >
                            Next
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Enhanced Edit Modal */}
            <Dialog open={!!editItem} onOpenChange={() => { setEditItem(null); setEditMode('view'); }}>
                <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="pb-2">
                        <DialogTitle className="font-serif text-xl">Item Details</DialogTitle>
                    </DialogHeader>

                    <Tabs value={editMode} onValueChange={(v) => setEditMode(v as 'view' | 'edit')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="view">View</TabsTrigger>
                            <TabsTrigger value="edit">Edit</TabsTrigger>
                        </TabsList>

                        {/* VIEW TAB */}
                        <TabsContent value="view" className="mt-0">
                            {editItem && (
                                <ItemDetailView
                                    item={editItem as any}
                                    onEdit={() => setEditMode('edit')}
                                    onDelete={() => {
                                        if (editItem) {
                                            setDeleteConfirm({ type: 'single', id: editItem.id })
                                        }
                                    }}
                                />
                            )}
                        </TabsContent>

                        {/* EDIT TAB */}
                        <TabsContent value="edit" className="mt-0">

                            <div className="grid gap-6 py-4">
                                {/* Title Row */}
                                <div className="grid gap-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Name</label>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            className="bg-zinc-900/50 border-zinc-800 font-medium"
                                            placeholder="Item Title"
                                        />
                                        <Button
                                            variant="secondary"
                                            onClick={() => doSearch(editTitle)}
                                            disabled={!editTitle}
                                            className="shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                                        >
                                            <Search className="w-4 h-4 mr-2" />
                                            Search
                                        </Button>
                                    </div>

                                    {/* Search Results */}
                                    {mediaResults.length > 0 && (
                                        <div className="mt-2 grid grid-cols-1 gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-2 max-h-[200px] overflow-y-auto">
                                            <div className="flex justify-between items-center px-1 pb-2">
                                                <span className="text-xs text-zinc-500">Select to auto-fill:</span>
                                                <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setMediaResults([])}>Clear</Button>
                                            </div>
                                            {mediaResults.map((result, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleMetadataMatch(result)}
                                                    className="flex items-start gap-3 p-2 hover:bg-zinc-800 rounded text-left transition-colors group"
                                                >
                                                    <div className="w-8 h-12 bg-zinc-800 rounded overflow-hidden shrink-0 relative">
                                                        {result.imageUrl ? <Image src={result.imageUrl} alt="" fill className="object-cover" /> : null}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-zinc-300 group-hover:text-cyan-400">{result.title}</div>
                                                        <div className="text-xs text-zinc-500 line-clamp-1">{result.description}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Category */}
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Category</label>
                                    <Select value={editCategoryType || 'null'} onValueChange={(val) => setEditCategoryType(val === 'null' ? null : val)}>
                                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800">
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                                            <SelectItem value="null">Uncategorized</SelectItem>
                                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Description */}
                                <div className="grid gap-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Description</label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs text-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/30"
                                            onClick={handleAutoFill}
                                            disabled={isGeneratingDescription || !editTitle}
                                        >
                                            {isGeneratingDescription ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />}
                                            Auto-Fill
                                        </Button>
                                    </div>
                                    <Textarea
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        rows={6}
                                        className={`bg-zinc-900/50 border-zinc-800 text-sm leading-relaxed text-zinc-300 resize-none ${isGeneratingDescription ? 'animate-pulse' : ''}`}
                                    />
                                </div>

                                {/* Bottom Row: Image & Tags */}
                                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
                                    {/* Image Column */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider block">Image</label>
                                        <div className="aspect-[2/3] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 relative group">
                                            {editImage ? (
                                                <>
                                                    <Image src={editImage} alt="Preview" fill className="object-cover" />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                                                        <Button size="sm" variant="secondary" className="w-full h-7 text-xs" onClick={() => setImageToCrop(editImage)}>
                                                            <Crop className="w-3 h-3 mr-1" /> Crop
                                                        </Button>
                                                        <Button size="sm" variant="destructive" className="w-full h-7 text-xs" onClick={() => setEditImage('')}>
                                                            <Trash2 className="w-3 h-3 mr-1" /> Remove
                                                        </Button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2 p-4 text-center">
                                                    <ImageIcon className="w-6 h-6" />
                                                    <span className="text-[10px]">No Image</span>
                                                </div>
                                            )}
                                        </div>

                                        {!editImage && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant={imageUploadMode === 'url' ? 'secondary' : 'outline'} size="sm" onClick={() => setImageUploadMode('url')} className="text-xs h-7">URL</Button>
                                                <Button variant={imageUploadMode === 'upload' ? 'secondary' : 'outline'} size="sm" onClick={() => setImageUploadMode('upload')} className="text-xs h-7">Up</Button>
                                            </div>
                                        )}

                                        {editImage ? null : imageUploadMode === 'url' ? (
                                            <Input value={editImage} onChange={e => setEditImage(e.target.value)} className="h-8 text-xs bg-zinc-900 border-zinc-800" placeholder="https://..." />
                                        ) : (
                                            <Input
                                                type="file"
                                                className="h-8 text-xs bg-zinc-900 border-zinc-800 file:text-zinc-400"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onload = () => setImageToCrop(reader.result as string)
                                                        reader.readAsDataURL(file)
                                                    }
                                                }}
                                            />
                                        )}
                                    </div>

                                    {/* Tags Column */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Tags</label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-950/30"
                                                onClick={handleAutoTag}
                                                disabled={isGeneratingTags || !editTitle}
                                            >
                                                {isGeneratingTags ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />}
                                                Auto-Tag
                                            </Button>
                                        </div>
                                        <div className="min-h-[200px] bg-zinc-900/30 border border-zinc-800 rounded-lg p-2">
                                            <TagSelector
                                                selectedTags={editTags}
                                                onTagsChange={setEditTags}
                                                isLoading={isGeneratingTags}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="border-t border-zinc-800/50 pt-4 flex justify-between sm:justify-between items-center">
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        if (editItem) {
                                            setDeleteConfirm({ type: 'single', id: editItem.id })
                                        }
                                    }}
                                    className="bg-red-950/50 text-white hover:bg-red-900/50 border border-red-900/50"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Item
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={() => setEditItem(null)}>Cancel</Button>
                                    <Button onClick={handleSaveEdit} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </DialogFooter>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Image Cropper Modal */}
            {imageToCrop && (
                <ImageCropper
                    imageSrc={imageToCrop}
                    aspectRatio={2 / 3}
                    onCropComplete={async (croppedImage) => {
                        const response = await fetch(croppedImage)
                        const blob = await response.blob()
                        const fileFormData = new FormData()
                        fileFormData.append('file', blob, 'cropped.jpg')
                        const { uploadImage } = await import('@/lib/actions/upload')
                        const url = await uploadImage(fileFormData)
                        if (url) setEditImage(url)
                        setImageToCrop(null)
                    }}
                    onCancel={() => setImageToCrop(null)}
                />
            )}


            {/* Maintenance Modal */}
            <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
                <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-zinc-100 font-bold">
                            <Settings className="w-5 h-5 text-blue-500" />
                            System Configuration
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Manage API keys and database maintenance.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* API Keys Section */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                                <Key className="w-4 h-4 text-yellow-500" />
                                API Keys
                            </h4>
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-500">SteamGridDB API Key (Vertical Covers)</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="password"
                                        placeholder="Enter key..."
                                        value={steamGridKey}
                                        onChange={(e) => setSteamGridKey(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-zinc-200 text-sm"
                                    />
                                    <Button
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-500"
                                        onClick={handleSaveConfig}
                                        disabled={actionLoading}
                                    >
                                        Save
                                    </Button>
                                </div>
                                <p className="text-[10px] text-zinc-600">
                                    Required for high-quality game cover harvesting.
                                </p>
                            </div>
                        </div>

                        <div className="h-px bg-zinc-800 w-full" />

                        {/* Maintenance Section */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4" />
                                Danger Zone
                            </h4>

                            <div className="p-4 bg-red-950/10 border border-red-900/30 rounded-lg space-y-3">
                                <h5 className="text-xs font-medium text-red-300 flex items-center gap-2">
                                    <Trash2 className="w-3 h-3" />
                                    Bulk Delete by Source
                                </h5>
                                <div className="grid grid-cols-2 gap-2">
                                    {['tmdb', 'tmdb_tv', 'anilist', 'bgg', 'rawg', 'google_books', 'spotify_artist', 'itunes_podcast'].map((key) => (
                                        <Button
                                            key={key}
                                            variant="outline"
                                            size="sm"
                                            className="justify-start border-zinc-800 hover:bg-red-950/30 hover:text-red-400 hover:border-red-900/50 transition-colors h-8 text-xs"
                                            onClick={() => {
                                                setDeleteConfirm({ type: 'source', source: key })
                                                setMaintenanceOpen(false)
                                            }}
                                        >
                                            {key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Safe Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => { if (!actionLoading) setDeleteConfirm(null) }}>
                <DialogContent className="bg-zinc-950 border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="text-red-500">
                            {deleteConfirm?.type === 'source' ? 'CRITICAL WARNING' : 'Confirm Deletion'}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-300">
                            {deleteConfirm?.type === 'selected'
                                ? `Are you sure you want to delete ${selectedIds.size} selected items?`
                                : deleteConfirm?.type === 'single'
                                    ? 'Are you sure you want to delete this item? This action cannot be undone.'
                                    : <>
                                        You are about to delete <span className="font-bold text-white">ALL</span> items from <span className="font-bold text-white">{(deleteConfirm?.source || '').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>.
                                        <br /><br />
                                        This action cannot be undone. All associated data will be lost forever.
                                    </>
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {deleteConfirm?.type === 'source' && (
                        <div className="py-2">
                            <label className="text-xs text-zinc-500 mb-1 block">Type <strong>DELETE</strong> to confirm:</label>
                            <Input
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                className="bg-red-950/20 border-red-900/50 text-red-200 placeholder:text-red-900/50 font-mono"
                                placeholder="DELETE"
                            />
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={actionLoading}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleBulkDelete}
                            disabled={actionLoading || (deleteConfirm?.type === 'source' && confirmText !== 'DELETE')}
                        >
                            {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

