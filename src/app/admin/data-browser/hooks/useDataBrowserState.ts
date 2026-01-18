'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { GlobalItem } from '../types'

export interface FilterState {
    selectedCategories: string[]
    missingImage: boolean
    shortDesc: boolean
    uncategorized: boolean
    searchQuery: string
    debouncedSearchQuery: string
}

export function useDataBrowserState() {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Filters
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [missingImage, setMissingImage] = useState(false)
    const [shortDesc, setShortDesc] = useState(false)
    const [uncategorized, setUncategorized] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

    // UI Config
    const [tileSize, setTileSize] = useState(50)
    const [page, setPage] = useState(1)
    const [inputPage, setInputPage] = useState<number | string>(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)

    // Sort
    const [sortField, setSortField] = useState('last_metadata_update')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const lastClickedRef = useRef<string | null>(null)

    // Modals
    const [editItem, setEditItem] = useState<GlobalItem | null>(null)
    const [editMode, setEditMode] = useState<'view' | 'edit'>('view')
    const [viewItem, setViewItem] = useState<GlobalItem | null>(null)
    const [reportItem, setReportItem] = useState<GlobalItem | null>(null)
    const [maintenanceOpen, setMaintenanceOpen] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'selected' | 'source'; source?: string; id?: string } | null>(null)
    const [confirmText, setConfirmText] = useState('')
    const [steamGridKey, setSteamGridKey] = useState('')

    // URL Filters (Memoized)
    const activeFilters = useMemo(() => {
        const filters: Record<string, string> = {}
        const filterKeys = [
            'director', 'cast', 'studio', 'genre', 'tag', 'developer',
            'platform', 'designer', 'mechanic', 'artist', 'content_rating',
            'year', 'category', 'writer', 'production', 'language'
        ]
        filterKeys.forEach(key => {
            const value = searchParams.get(key)
            if (value) filters[key] = value
        })
        return filters
    }, [searchParams])

    // Calculate Page Size based on tile size
    const pageSize = useMemo(() => {
        if (tileSize <= 15) return 120
        if (tileSize <= 30) return 80
        if (tileSize <= 50) return 56
        if (tileSize <= 70) return 36
        if (tileSize <= 85) return 25
        return 16
    }, [tileSize])

    // Selection Handler
    const handleItemClick = useCallback((id: string, items: GlobalItem[], event: React.MouseEvent) => {
        // Prevent text selection on shift+click
        if (event.shiftKey) {
            event.preventDefault()
        }

        const target = event.target as HTMLElement
        if (target.closest('button') || target.closest('[role="button"]')) {
            return
        }

        const newSet = new Set(selectedIds)

        if (event.shiftKey && lastClickedRef.current) {
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
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
        } else {
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.clear()
                newSet.add(id)
            }
        }

        lastClickedRef.current = id
        setSelectedIds(newSet)
    }, [selectedIds])

    const toggleId = useCallback((id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }, [selectedIds])

    const removeFilter = useCallback((key: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete(key)
        router.push(`?${params.toString()}`)
    }, [searchParams, router])

    const clearAllFilters = useCallback(() => {
        router.push(window.location.pathname)
        setSelectedCategories([])
        setMissingImage(false)
        setShortDesc(false)
        setUncategorized(false)
        setSearchQuery('')
        setDebouncedSearchQuery('')
    }, [router])

    return {
        activeFilters,
        filters: {
            selectedCategories, setSelectedCategories,
            missingImage, setMissingImage,
            shortDesc, setShortDesc,
            uncategorized, setUncategorized,
            searchQuery, setSearchQuery,
            debouncedSearchQuery, setDebouncedSearchQuery,
            activeFilters,
            removeFilter,
            clearAllFilters
        },
        ui: {
            tileSize, setTileSize,
            page, setPage,
            totalPages, setTotalPages,
            totalCount, setTotalCount,
            pageSize,
            inputPage, setInputPage
        },
        sort: {
            sortField, setSortField,
            sortOrder, setSortOrder
        },
        selection: {
            selectedIds, setSelectedIds,
            handleItemClick,
            lastClickedRef,
            toggleId
        },
        modals: {
            editItem, setEditItem,
            editMode, setEditMode,
            viewItem, setViewItem,
            reportItem, setReportItem,
            maintenanceOpen, setMaintenanceOpen,
            deleteConfirm, setDeleteConfirm,
            confirmText, setConfirmText,
            steamGridKey, setSteamGridKey
        },
        // Utils
        router,
        searchParams
    }
}
