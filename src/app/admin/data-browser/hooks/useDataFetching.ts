'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { normalizeCategory } from '@/lib/constants'
import type { GlobalItem, Stats } from '../types'
import type { useDataBrowserState } from './useDataBrowserState'

// Helper to infer the return type of the state hook
type BrowserState = ReturnType<typeof useDataBrowserState>

export function useDataFetching(state: BrowserState) {
    const { filters, ui, sort } = state
    const [items, setItems] = useState<GlobalItem[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Stats>({ total: 0, byCategory: {} })
    const supabase = createClient()

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
        if (filters.shortDesc && !filters.missingImage && !filters.uncategorized) {
            try {
                // Get IDs of items with short descriptions
                const { data: shortIds, error: rpcError } = await ((supabase as any).rpc('get_short_description_items', {
                    p_category_types: filters.selectedCategories.length > 0 ? filters.selectedCategories : null,
                    p_limit: ui.pageSize,
                    p_offset: (ui.page - 1) * ui.pageSize
                }) as any)

                if (rpcError) {
                    console.error('Error fetching short descriptions:', rpcError)
                    setLoading(false)
                    return
                }

                if (!shortIds || shortIds.length === 0) {
                    setItems([])
                    ui.setTotalPages(0)
                    ui.setTotalCount(0)
                    setLoading(false)
                    return
                }

                // Fetch full items by IDs
                const { data, error } = await supabase
                    .from('global_items')
                    .select('*')
                    .in('id', shortIds.map((r: any) => r.id))
                    .order(sort.sortField, { ascending: sort.sortOrder === 'asc', nullsFirst: false })

                if (error) {
                    console.error('Error fetching items:', error)
                    setLoading(false)
                    return
                }

                setItems(data || [])
                ui.setTotalPages(1) // RPC doesn't return total count easily
                ui.setTotalCount(shortIds.length)
                setLoading(false)
                return
            } catch (err) {
                console.error('Short description RPC error:', err)
                setLoading(false)
                return
            }
        }

        // =================================================================
        // OPTIMIZED PATH: Use browse_items RPC for basic browsing
        // =================================================================
        const hasActiveFilters = Object.keys(filters.activeFilters).length > 0
        const hasAdvancedFilters = filters.missingImage || filters.uncategorized || hasActiveFilters

        if (!hasAdvancedFilters) {
            try {
                const { data, error } = await ((supabase as any).rpc('browse_items', {
                    p_category_types: filters.selectedCategories.length > 0 ? filters.selectedCategories : null,
                    p_search: filters.debouncedSearchQuery && filters.debouncedSearchQuery.length >= 3 ? filters.debouncedSearchQuery : null,
                    p_page: ui.page,
                    p_page_size: ui.pageSize,
                    p_sort_field: sort.sortField,
                    p_sort_order: sort.sortOrder
                }) as any)

                if (error) {
                    console.error('RPC error:', error)
                    toast.error('Failed to load items: ' + (error?.message || 'Unknown error'))
                    setItems([])
                    ui.setTotalPages(0)
                    ui.setTotalCount(0)
                    setLoading(false)
                    return
                }

                // Total count is included in each row
                const totalCount = data?.[0]?.total_count || 0
                setItems(data || [])
                ui.setTotalPages(Math.ceil(totalCount / ui.pageSize))
                ui.setTotalCount(totalCount)
                setLoading(false)
                return
            } catch (err: any) {
                console.error('RPC exception:', err)
                toast.error('Query failed: ' + (err?.message || 'Timeout'))
                setItems([])
                ui.setTotalPages(0)
                ui.setTotalCount(0)
                setLoading(false)
                return
            }
        }

        // =================================================================
        // ADVANCED FILTERS PATH: Full query with all columns
        // =================================================================
        const SELECTED_COLUMNS = 'id,external_id,source,title,description,image_url,release_year,metadata,cached_tags,category_type,last_metadata_update,created_at,external_ids,cast,director,writer,studio,genres,content_rating,runtime,vote_average,trailer_url,tagline,episodes,season,source_material,romaji_title,original_creator,platforms,developers,publishers,playtime,metacritic,min_players,max_players,min_playtime,max_playtime,min_age,mechanics,categories,complexity,designers,artists,is_expansion,bgg_id,original_language,origin_countries,original_title,status,homepage,budget,revenue,production_companies,networks,number_of_seasons,number_of_episodes,keywords,watch_providers,backdrop_path,logo_path,studios,banner_url,imdb_rating,imdb_votes,rotten_tomatoes_rating,metacritic_rating,awards_text,box_office,time_to_beat,game_engines,websites,game_modes,perspectives,videos,screenshots,franchise,dlc_count,release_date,families,rank_overall,best_players,min_age_community,language_dependence,followers,album_type,label,total_tracks,upc,audio_features,isrc,duration_ms,album_name,artist_names,preview_url,volumes,chapters,format,staff,description_length,description_parts,anilist_score,vote_count,popularity,track_number,themes'

        let query = supabase
            .from('global_items')
            .select(SELECTED_COLUMNS, { count: 'estimated' })
            .order(sort.sortField, { ascending: sort.sortOrder === 'asc', nullsFirst: false })
            .range((ui.page - 1) * ui.pageSize, ui.page * ui.pageSize - 1)

        // Text Search
        if (filters.debouncedSearchQuery && filters.debouncedSearchQuery.length >= 3) {
            const cleanQuery = filters.debouncedSearchQuery.trim()
            query = query.ilike('title', `%${cleanQuery}%`)
        }

        // URL-based filters (Exact match)
        const af = filters.activeFilters
        if (af.director) query = query.eq('director', af.director)
        if (af.studio) query = query.eq('studio', af.studio)
        if (af.content_rating) query = query.eq('content_rating', af.content_rating)
        if (af.year) query = query.eq('release_year', parseInt(af.year))
        if (af.category) query = query.eq('category_type', af.category.toUpperCase().replace(/-/g, '_'))
        if (af.language) query = query.eq('original_language', af.language)
        if (af.writer) query = query.ilike('writer', `%${af.writer}%`)

        // Array contains filters
        if (af.cast) query = query.contains('cast', [af.cast])
        if (af.genre) query = query.contains('genres', [af.genre])
        if (af.platform) query = query.contains('platforms', [af.platform])
        if (af.designer) query = query.contains('designers', [af.designer])
        if (af.mechanic) query = query.contains('mechanics', [af.mechanic])
        if (af.artist) query = query.contains('artists', [af.artist])
        if (af.tag) query = query.contains('cached_tags', [{ name: af.tag }])

        if (af.developer) {
            const dev = af.developer.replace(/"/g, '\\"').replace(/,/g, '\\,')
            query = query.or(`studio.eq."${dev}",developers.cs.{"${dev}"}`)
        }
        if (af.production) {
            const prod = af.production.replace(/"/g, '\\"').replace(/,/g, '\\,')
            query = query.or(`production_companies.cs.{"${prod}"},networks.cs.{"${prod}"},publishers.cs.{"${prod}"}`)
        }

        // Build OR conditions
        const orConditions: string[] = []

        if (filters.selectedCategories.length > 0) {
            query = query.in('category_type', filters.selectedCategories)
        }

        if (filters.missingImage) orConditions.push('image_url.is.null')
        if (filters.uncategorized) orConditions.push('category_type.is.null')

        if (orConditions.length > 0) {
            query = query.or(orConditions.join(','))
        }

        try {
            const { data, count, error } = await query

            if (error) {
                console.error('Error fetching items:', error)
                toast.error('Failed to load items')
                setItems([])
                ui.setTotalPages(0)
                ui.setTotalCount(0)
                return
            }

            setItems(data || [])
            ui.setTotalPages(Math.ceil((count || 0) / ui.pageSize))
            ui.setTotalCount(count || 0)
        } catch (err: any) {
            console.error('Exception fetching items:', err)
            toast.error('Search failed')
            setItems([])
            ui.setTotalPages(0)
            ui.setTotalCount(0)
        } finally {
            setLoading(false)
        }
    }, [supabase, ui.page, ui.pageSize, filters.debouncedSearchQuery, filters.missingImage, filters.shortDesc, filters.uncategorized, filters.selectedCategories, filters.activeFilters, sort.sortField, sort.sortOrder])

    // Effects
    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    // Reset page on filter change
    useEffect(() => {
        ui.setPage(1)
    }, [filters.debouncedSearchQuery, filters.selectedCategories, filters.missingImage, filters.shortDesc, filters.uncategorized])

    // Defer stats loading
    useEffect(() => {
        const timer = setTimeout(() => fetchStats(), 100)
        return () => clearTimeout(timer)
    }, [fetchStats])

    return {
        items,
        setItems, // Exposed for manual updates (deletion)
        loading,
        setLoading,
        stats,
        fetchItems,
        fetchStats
    }
}
