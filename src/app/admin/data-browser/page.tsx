'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
    Loader2, Wand2, Crop, Key, Settings, Tag, MoreHorizontal, Flag
} from 'lucide-react'
import TagSelector from '@/components/tags/TagSelector'
import ImageCropper from '@/components/ImageCropper'
import { toast } from 'sonner'
import Image from 'next/image'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CATEGORY_LABELS, normalizeCategory, formatCategoryLabel, CATEGORY_TYPES } from '@/lib/constants'
import ItemDetailView from '@/components/item-details/ItemDetailView'
import { AdvancedFilterBar } from '@/components/admin/data-browser/AdvancedFilterBar'
import ReportItemDialog from '@/components/dialogs/ReportItemDialog'
import pLimit from 'p-limit'

// ============================================================================
// TYPES
// ============================================================================

interface GlobalItem {
    id: string
    title: string
    description: string | null
    image_url: string | null
    backdrop_path: string | null
    category_type: string
    release_year: number | null
    external_ids: Record<string, any> | null
    metadata: Record<string, any> | null
    created_at: string
    cached_tags: { id: string, name: string }[] | null
    genres: string[] | null

    // Extended fields for ItemDetailView
    status: string | null
    number_of_seasons: number | null
    number_of_episodes: number | null
    director: string | null
    writer: string | null
    studio: string | null
    production_companies: string[] | null
    networks: string[] | null
    cast: string[] | null
    budget: number | null
    box_office: number | null
    revenue: number | null
    vote_average: number | null
    trailer_url: string | null
    spotify_url: string | null
    imdb_rating: string | null
    rotten_tomatoes_rating: string | null
    metacritic_rating: string | null
    runtime: number | null
    original_language: string | null
    content_rating: string | null
    tagline: string | null
    awards_text: string | null
    developers: string[] | null
    publishers: string[] | null
    url: string | null
    romaji_title: string | null
    season: string | null
    source_material: string | null
    original_creator: string | null
    original_title: string | null
    anilist_score: number | null
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
    [CATEGORY_TYPES.MUSIC_ARTIST]: { icon: Music, color: 'text-emerald-400', label: 'Artists' },
    [CATEGORY_TYPES.ALBUM]: { icon: Music, color: 'text-teal-400', label: 'Albums' },
    [CATEGORY_TYPES.MUSIC_TRACK]: { icon: Music, color: 'text-cyan-400', label: 'Tracks' },
    [CATEGORY_TYPES.PODCAST]: { icon: Mic, color: 'text-red-400', label: 'Podcasts' },
    [CATEGORY_TYPES.COMICS]: { icon: BookOpen, color: 'text-amber-400', label: 'Comics' },
    [CATEGORY_TYPES.MANGA]: { icon: BookOpen, color: 'text-rose-400', label: 'Manga' },
    [CATEGORY_TYPES.LIGHT_NOVEL]: { icon: BookOpen, color: 'text-indigo-400', label: 'Light Novels' },
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
        const filterKeys = ['director', 'cast', 'studio', 'genre', 'tag', 'developer', 'platform', 'designer', 'mechanic', 'artist', 'content_rating', 'year', 'category', 'writer', 'production', 'language']
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

    // Sort State (Default to created_at desc)
    const [sortField, setSortField] = useState('last_metadata_update')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    // Dynamic page size based on tile size / grid columns
    // Estimates visible rows * columns to fill viewport
    const getItemsPerPage = useCallback(() => {
        // Approximate columns at different tile sizes
        if (tileSize <= 15) return 120  // 12 cols * 10 rows
        if (tileSize <= 30) return 80   // 10 cols * 8 rows
        if (tileSize <= 50) return 56   // 8 cols * 7 rows
        if (tileSize <= 70) return 36   // 6 cols * 6 rows
        if (tileSize <= 85) return 25   // 5 cols * 5 rows
        return 16                        // 4 cols * 4 rows
    }, [tileSize])

    const pageSize = getItemsPerPage()

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
    const [reportItem, setReportItem] = useState<GlobalItem | null>(null)
    const [viewItem, setViewItem] = useState<GlobalItem | null>(null)  // Item details view
    const [maintenanceOpen, setMaintenanceOpen] = useState(false)
    const [steamGridKey, setSteamGridKey] = useState('')
    const [confirmText, setConfirmText] = useState('')
    const [actionLoading, setActionLoading] = useState(false)

    // Bulk action state
    const [bulkActionProgress, setBulkActionProgress] = useState<{ current: number; total: number; action: string } | null>(null)

    // Per-item regeneration loading states
    const [regeneratingDescriptionIds, setRegeneratingDescriptionIds] = useState<Set<string>>(new Set())
    const [regeneratingTagIds, setRegeneratingTagIds] = useState<Set<string>>(new Set())

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
        // Fetch raw count (often fails or returns 0 if RLS is strict on count(*))
        const { count } = await supabase
            .from('global_items')
            .select('*', { count: 'exact', head: true })

        // Fetch category breakdown (Security Definer RPC - reliable)
        const { data: catStats } = await (supabase.rpc('get_category_stats') as any)

        // Group by normalized category to merge variations
        const byCategory: Record<string, number> = {}
        let sumFromCategories = 0

        if (catStats) {
            catStats.forEach((item: any) => {
                const key = normalizeCategory(item.category)
                byCategory[key] = (byCategory[key] || 0) + item.count
                sumFromCategories += item.count
            })
        }

        // Fallback: If count is 0 but we have category stats, use the sum
        const effectiveTotal = (count && count > 0) ? count : sumFromCategories

        setStats({ total: effectiveTotal || 0, byCategory })
    }, [supabase])

    const fetchItems = useCallback(async () => {
        setLoading(true)

        // Special case: Short Description filter uses dedicated RPC
        if (shortDesc && !missingImage && !uncategorized) {
            try {
                // Get IDs of items with short descriptions
                const { data: shortIds, error: rpcError } = await ((supabase as any).rpc('get_short_description_items', {
                    p_category_types: selectedCategories.length > 0 ? selectedCategories : null,
                    p_limit: pageSize,
                    p_offset: (page - 1) * pageSize
                }) as any)

                if (rpcError) {
                    console.error('Error fetching short descriptions:', rpcError)
                    setLoading(false)
                    return
                }

                if (!shortIds || shortIds.length === 0) {
                    setItems([])
                    setTotalPages(0)
                    setTotalCount(0)
                    setLoading(false)
                    return
                }

                // Fetch full items by IDs
                const { data, error } = await supabase
                    .from('global_items')
                    .select('*')
                    .in('id', shortIds.map((r: any) => r.id))
                    .order(sortField, { ascending: sortOrder === 'asc', nullsFirst: false })

                if (error) {
                    console.error('Error fetching items:', error)
                    setLoading(false)
                    return
                }

                setItems(data || [])
                setTotalPages(1) // RPC doesn't return total count easily
                setTotalCount(shortIds.length)
                setLoading(false)
                return
            } catch (err) {
                console.error('Short description RPC error:', err)
                setLoading(false)
                return
            }
        }

        // Base Query (normal path)
        let query = supabase
            .from('global_items')
            .select('*', { count: 'exact' })
            .order(sortField, { ascending: sortOrder === 'asc', nullsFirst: false })
            .range((page - 1) * pageSize, page * pageSize - 1)

        // Text Search - require 3+ chars to avoid expensive full-table scans
        if (searchQuery && searchQuery.length >= 3) {
            // Use simpler pattern matching for better performance
            const cleanQuery = searchQuery.trim()
            query = query.ilike('title', `%${cleanQuery}%`)
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
        if (activeFilters.language) {
            query = query.eq('original_language', activeFilters.language)
        }
        if (activeFilters.writer) {
            query = query.ilike('writer', `%${activeFilters.writer}%`)
        }

        // Array contains filters (cast, genres, platforms, etc.)
        if (activeFilters.cast) {
            query = query.contains('cast', [activeFilters.cast])
        }
        if (activeFilters.genre) {
            query = query.contains('genres', [activeFilters.genre])
        }
        if (activeFilters.developer) {
            // Escape special characters for PostgREST query
            const dev = activeFilters.developer.replace(/"/g, '\\"').replace(/,/g, '\\,')
            query = query.or(`studio.eq."${dev}",developers.cs.{"${dev}"}`)
        }
        if (activeFilters.production) {
            // Escape special characters for PostgREST query
            const prod = activeFilters.production.replace(/"/g, '\\"').replace(/,/g, '\\,')
            query = query.or(`production_companies.cs.{"${prod}"},networks.cs.{"${prod}"},publishers.cs.{"${prod}"}`)
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

        if (uncategorized) {
            orConditions.push('category_type.is.null')
        }

        // Apply combined OR filter for quality issues
        if (orConditions.length > 0) {
            query = query.or(orConditions.join(','))
        }

        const { data, count, error } = await query

        if (error) {
            console.error('Error fetching items:', (error as any)?.message || error)
            console.error('Active filters:', JSON.stringify(activeFilters, null, 2))
            console.error('Search query:', searchQuery)
            setLoading(false)
            return
        }

        setItems(data || [])
        setTotalPages(Math.ceil((count || 0) / pageSize))
        setTotalCount(count || 0)
        setLoading(false)
    }, [supabase, page, searchQuery, missingImage, shortDesc, uncategorized, selectedCategories, pageSize, activeFilters, sortField, sortOrder])

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

    // Track last clicked item for Shift selection - use useRef to persist across renders
    const lastClickedRef = useRef<string | null>(null)

    const handleItemClick = (id: string, event: React.MouseEvent) => {
        // Prevent text selection on shift+click
        if (event.shiftKey) {
            event.preventDefault()
        }

        // Don't select if clicking on action buttons (edit/view/regen)
        const target = event.target as HTMLElement
        if (target.closest('button') || target.closest('[role="button"]')) {
            return
        }

        const newSet = new Set(selectedIds)

        if (event.shiftKey && lastClickedRef.current) {
            // Shift+click: Select range between last clicked and current
            const lastIdx = items.findIndex(i => i.id === lastClickedRef.current)
            const currentIdx = items.findIndex(i => i.id === id)

            if (lastIdx !== -1 && currentIdx !== -1) {
                const start = Math.min(lastIdx, currentIdx)
                const end = Math.max(lastIdx, currentIdx)

                for (let i = start; i <= end; i++) {
                    newSet.add(items[i].id)
                }
            }
        } else if (event.ctrlKey || event.metaKey) {
            // Ctrl+click: Toggle single item (add/remove from selection)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
        } else {
            // Normal click: Toggle selection for this item
            if (newSet.has(id)) {
                // If already selected, deselect it
                newSet.delete(id)
            } else {
                // Otherwise clear others and select this one
                newSet.clear()
                newSet.add(id)
            }
        }

        lastClickedRef.current = id
        setSelectedIds(newSet)
    }

    // Double-click handler to open item details
    const handleItemDoubleClick = (item: GlobalItem) => {
        setViewItem(item)
    }

    // Clear selection handler
    const handleClearSelection = () => {
        setSelectedIds(new Set())
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
        // Add to loading set
        setRegeneratingDescriptionIds(prev => new Set(prev).add(item.id))

        try {
            // Call the new enrich-metadata endpoint (fetches from category-specific providers)
            const response = await fetch('/api/ai/enrich-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, title: item.title, type: item.category_type })
            })

            if (response.ok) {
                const data = await response.json()
                // Update local state with description AND all enriched fields (ratings, etc.)
                setItems(prev => prev.map(i =>
                    i.id === item.id
                        ? {
                            ...i,
                            description: data.description,
                            description_parts: data.description_parts,
                            ...data.enrichedData // Merge all enriched fields (imdb_rating, rotten_tomatoes_rating, etc.)
                        }
                        : i
                ))

                // Toast with provider and OMDB info
                if (data.enriched) {
                    let message = `Enriched from ${data.provider}: ${data.fieldsUpdated.length} fields`
                    if (data.omdbStatus === 'success' && data.omdbRatings?.length > 0) {
                        message += ` (${data.omdbRatings.join(', ')})`
                    } else if (data.omdbStatus === 'not_found') {
                        message += ' (No OMDB ratings found)'
                    }
                    toast.success(message)
                } else {
                    toast.success('Description regenerated')
                }
            } else {
                toast.error('Failed to enrich metadata')
            }
        } catch (error) {
            console.error('Failed to regenerate:', error)
            toast.error('Failed to regenerate description')
        } finally {
            // Remove from loading set
            setRegeneratingDescriptionIds(prev => {
                const next = new Set(prev)
                next.delete(item.id)
                return next
            })
        }
    }

    const handleGenerateTagsForItem = async (item: GlobalItem) => {
        // Add to loading set
        setRegeneratingTagIds(prev => new Set(prev).add(item.id))

        try {
            const { generateTagsAction } = await import('@/lib/actions/ai')
            const data = await generateTagsAction({
                title: item.title,
                type: item.category_type,
                description: item.description || ''
            })

            if (data.tags && data.tags.length > 0) {
                const { createTagsBatch } = await import('@/lib/actions/tags')
                const validTags = await createTagsBatch(data.tags)
                const cachedTags = validTags.map(t => ({ id: t.id, name: t.name }))

                // Save to database
                await (supabase.from('global_items') as any).update({
                    cached_tags: cachedTags
                }).eq('id', item.id)

                // Update local state immediately
                setItems(prev => prev.map(i =>
                    i.id === item.id
                        ? { ...i, cached_tags: cachedTags }
                        : i
                ))

                toast.success(`Generated ${validTags.length} tags`)
            } else {
                toast.error('No tags generated')
            }
        } catch (error) {
            console.error('Failed to generate tags:', error)
            toast.error('Failed to generate tags')
        } finally {
            // Remove from loading set
            setRegeneratingTagIds(prev => {
                const next = new Set(prev)
                next.delete(item.id)
                return next
            })
        }
    }

    // ========================================================================
    // BULK ACTIONS
    // ========================================================================

    const handleBulkRegenerateDescriptions = async () => {
        if (selectedIds.size === 0) return

        const ids = Array.from(selectedIds)
        const total = ids.length
        const limit = pLimit(5) // Concurrency of 5

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
                const response = await fetch('/api/ai/regenerate-description', {
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
        setSelectedIds(new Set())
        fetchItems()
        toast.success(`Regenerated ${success}/${total} descriptions`)
    }

    const handleBulkRegenerateTags = async () => {
        if (selectedIds.size === 0) return

        const ids = Array.from(selectedIds)
        const total = ids.length
        const limit = pLimit(5) // Concurrency of 5

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
                    type: item.category_type,
                    description: item.description || ''
                })

                if (data.tags && data.tags.length > 0) {
                    const validTags = await createTagsBatch(data.tags)
                    await (supabase.from('global_items') as any).update({
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
        setSelectedIds(new Set())
        fetchItems()
        toast.success(`Regenerated tags for ${success}/${total} items`)
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
                    <div className="flex flex-col gap-4 mb-4 bg-zinc-900/30 p-4 rounded-lg border border-zinc-800">
                        {/* Advanced Filters */}
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <AdvancedFilterBar
                                categoryType={selectedCategories[0]} // Pass first selected category as context, or undefined
                                currentSort={sortField}
                                currentOrder={sortOrder}
                                onSortChange={(field: string, order: 'asc' | 'desc') => {
                                    setSortField(field)
                                    setSortOrder(order)
                                }}
                            />

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-4 pl-2">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleSelectVisible}
                                            className="h-7 text-xs border-zinc-700 hover:bg-zinc-800"
                                        >
                                            {items.length > 0 && items.every(i => selectedIds.has(i.id)) ? 'Deselect All' : 'Select All'}
                                        </Button>
                                        {selectedIds.size > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleClearSelection}
                                                className="h-7 text-xs text-zinc-400 hover:text-white"
                                            >
                                                <X className="w-3 h-3 mr-1" />
                                                Clear ({selectedIds.size})
                                            </Button>
                                        )}
                                        <span className="text-xs text-zinc-600">|</span>
                                        <span className="text-xs text-zinc-500">
                                            {items.length} on page / {totalCount.toLocaleString()} total
                                        </span>

                                    </div>

                                    {selectedIds.size > 0 && !bulkActionProgress && (
                                        <>
                                            <div className="h-4 w-px bg-zinc-700" />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleBulkRegenerateDescriptions}
                                                className="h-8 text-xs border-zinc-700 hover:bg-zinc-800"
                                            >
                                                <Sparkles className="w-3 h-3 mr-2" />
                                                Regen Descriptions
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleBulkRegenerateTags}
                                                className="h-8 text-xs border-zinc-700 hover:bg-zinc-800"
                                            >
                                                <Tag className="w-3 h-3 mr-2" />
                                                Regen Tags
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setDeleteConfirm({ type: 'selected' })}
                                                className="h-8 text-xs"
                                            >
                                                <Trash2 className="w-3 h-3 mr-2" />
                                                Delete
                                            </Button>
                                        </>
                                    )}

                                    {bulkActionProgress && (
                                        <div className="flex items-center gap-2 text-xs text-cyan-400">
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                            <span>{bulkActionProgress.action}: {bulkActionProgress.current}/{bulkActionProgress.total}</span>
                                        </div>
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
                                                onClick={(e) => handleItemClick(item.id, e)}
                                                onDoubleClick={() => handleItemDoubleClick(item)}
                                                className={`select-none group bg-zinc-900/40 border-zinc-800/50 overflow-hidden cursor-pointer transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-cyan-900/10 ${selectedIds.has(item.id) ? 'ring-2 ring-cyan-500 border-transparent' : ''}`}
                                            >
                                                <div className="relative aspect-[2/3] bg-zinc-900 overflow-hidden">
                                                    {item.image_url ? (
                                                        <Image
                                                            src={item.image_url}
                                                            alt={item.title}
                                                            fill
                                                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 p-4 text-center">
                                                            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                                            <span className="text-xs">No Image</span>
                                                        </div>
                                                    )}

                                                    {/* Overlays */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                                                    {/* Selection Indicator (checkmark when selected) */}
                                                    {selectedIds.has(item.id) && (
                                                        <div className="absolute top-2 left-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center z-10">
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                    )}

                                                    {/* Category Icon (always visible, top-right) */}
                                                    <div className="absolute top-2 right-2 z-10 group-hover:opacity-0 transition-opacity">
                                                        <div className="w-6 h-6 rounded-md bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                                            <CategoryIcon className="w-3.5 h-3.5 text-white/80" />
                                                        </div>
                                                    </div>

                                                    {/* Top-Right Context Menu (appears on hover) */}
                                                    <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    size="icon"
                                                                    variant="secondary"
                                                                    className="h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-md"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <MoreHorizontal className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 min-w-[140px]">
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setEditItem(item)
                                                                        setEditCategoryType(item.category_type)
                                                                        setEditTitle(item.title)
                                                                        setEditDescription(item.description || '')
                                                                        setEditImage(item.image_url || '')
                                                                        setEditTags(parseCachedTags(item.cached_tags).map(t => t.id))
                                                                        setEditMetadata(item.metadata ? JSON.stringify(item.metadata) : '')
                                                                        setEditMode('edit')
                                                                    }}
                                                                    className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5 mr-2" />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleGenerateTagsForItem(item)
                                                                    }}
                                                                    disabled={regeneratingTagIds.has(item.id)}
                                                                    className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"
                                                                >
                                                                    <Tag className="w-3.5 h-3.5 mr-2" />
                                                                    Generate Tags
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        console.log('Raw data:', item)
                                                                        toast.info('Raw data logged to console')
                                                                    }}
                                                                    className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"
                                                                >
                                                                    <FileText className="w-3.5 h-3.5 mr-2" />
                                                                    Raw Data
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setReportItem(item)
                                                                    }}
                                                                    className="text-amber-400 focus:bg-amber-950/50 focus:text-amber-300 cursor-pointer"
                                                                >
                                                                    <Flag className="w-3.5 h-3.5 mr-2" />
                                                                    Flag Data
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator className="bg-zinc-800" />
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setDeleteConfirm({ type: 'single', id: item.id })
                                                                    }}
                                                                    className="text-red-400 focus:bg-red-950/50 focus:text-red-300 cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>

                                                    {/* Hero Action - Single Analyze Button */}
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[1px]">
                                                        <Button
                                                            variant="secondary"
                                                            className="bg-cyan-600 hover:bg-cyan-500 text-white border-0 shadow-lg shadow-cyan-900/30 px-4 py-2 h-auto gap-2"
                                                            disabled={regeneratingDescriptionIds.has(item.id)}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleRegenerate(item)
                                                            }}
                                                        >
                                                            {regeneratingDescriptionIds.has(item.id) ? (
                                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Sparkles className="w-4 h-4" />
                                                            )}
                                                            <span className="text-sm font-medium">
                                                                {regeneratingDescriptionIds.has(item.id) ? 'Analyzing...' : 'Analyze'}
                                                            </span>
                                                        </Button>
                                                    </div>

                                                    {/* Title Overlay with Year */}
                                                    <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
                                                        <h4 className="font-medium text-sm text-white leading-tight line-clamp-2 drop-shadow-md">{item.title}</h4>
                                                        {item.release_year && (
                                                            <p className="text-xs text-zinc-400 mt-0.5">{item.release_year}</p>
                                                        )}
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
                            <div className="w-full flex flex-col items-center gap-3 mt-8 pb-8">
                                <div className="flex items-center gap-2">
                                    {/* First Page */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 1}
                                        onClick={() => setPage(1)}
                                        className="bg-black border-zinc-700 px-2"
                                        title="First Page"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        <ChevronLeft className="w-4 h-4 -ml-2" />
                                    </Button>

                                    {/* Previous */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                        className="bg-black border-zinc-700"
                                    >
                                        <ChevronLeft className="w-4 h-4 mr-1" />
                                        Prev
                                    </Button>

                                    {/* Page Input */}
                                    <div className="flex items-center gap-2 px-3">
                                        <span className="text-sm text-zinc-500">Page</span>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={totalPages}
                                            value={page}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value)
                                                if (!isNaN(val) && val >= 1 && val <= totalPages) {
                                                    setPage(val)
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const val = parseInt(e.target.value)
                                                if (isNaN(val) || val < 1) setPage(1)
                                                else if (val > totalPages) setPage(totalPages)
                                            }}
                                            className="w-16 h-8 bg-zinc-900 border-zinc-700 text-center font-mono text-sm"
                                        />
                                        <span className="text-sm text-zinc-500">of</span>
                                        <span className="text-sm text-zinc-300 font-mono">{totalPages}</span>
                                    </div>

                                    {/* Next */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                        className="bg-black border-zinc-700"
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>

                                    {/* Last Page */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === totalPages}
                                        onClick={() => setPage(totalPages)}
                                        className="bg-black border-zinc-700 px-2"
                                        title="Last Page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                        <ChevronRight className="w-4 h-4 -ml-2" />
                                    </Button>
                                </div>

                                {/* Item Count Info */}
                                <span className="text-xs text-zinc-500">
                                    {totalCount.toLocaleString()} items total
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* View Mode */}
                    <ItemDetailView
                        item={editItem as any}
                        isOpen={!!editItem && editMode === 'view'}
                        onClose={() => { setEditItem(null); setEditMode('view'); }}
                        onEdit={() => setEditMode('edit')}
                        onDelete={() => {
                            if (editItem) {
                                setDeleteConfirm({ type: 'single', id: editItem.id })
                            }
                        }}
                    />

                    {/* Edit Mode */}
                    <Dialog open={!!editItem && editMode === 'edit'} onOpenChange={(open) => { if (!open) { setEditItem(null); setEditMode('view'); } }}>
                        <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader className="pb-2">
                                <DialogTitle className="font-serif text-xl">Edit Item</DialogTitle>
                            </DialogHeader>



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
                                    <Button variant="ghost" onClick={() => setEditMode('view')}>Cancel</Button>
                                    <Button onClick={handleSaveEdit} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </DialogFooter>
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

                {/* Report Dialog */}
                {reportItem && (
                    <ReportItemDialog
                        globalItemId={reportItem.id}
                        itemTitle={reportItem.title}
                        open={!!reportItem}
                        onOpenChange={(open) => !open && setReportItem(null)}
                    />
                )}

                {/* Item Detail View */}
                <ItemDetailView
                    item={viewItem as any}
                    isOpen={!!viewItem}
                    onClose={() => setViewItem(null)}
                    onEdit={(item: any) => {
                        setViewItem(null)
                        setEditItem(item)
                        setEditCategoryType(item.category_type)
                        setEditTitle(item.title)
                        setEditDescription(item.description || '')
                        setEditImage(item.image_url || '')
                        setEditTags(parseCachedTags(item.cached_tags).map((t: any) => t.id))
                        setEditMetadata(item.metadata ? JSON.stringify(item.metadata) : '')
                        setEditMode('edit')
                    }}
                    onDelete={(id) => {
                        setViewItem(null)
                        setDeleteConfirm({ type: 'single', id })
                    }}
                />
            </div>
        </div>
    )
}

