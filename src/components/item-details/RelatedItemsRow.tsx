'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Sparkles, Film } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import {
    Tooltip,
    TooltipArrow,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip'
import { CATEGORY_LABELS } from '@/lib/constants'
import { getBatchSimilarityExplanations, type SimilarityExplanation } from '@/lib/actions/similarity-explanations'
import { SimilarityTooltipContent } from './SimilarityTooltipContent'

interface RelatedItem {
    id: string
    title: string
    image_url: string | null
    category_type: string | null
    similarity: number
    hybrid_score: number
    release_year: number | null
    runtime: number | null
    vote_average: number | null
    shared_traits: string[] | null
    difference_factors: string[] | null
}

interface RelatedItemsRowProps {
    sourceItemId: string
    matchCount?: number
    categoryFilter?: string | null
    /** 'standard' = horizontal scroll with vertical cards (mobile), 'compact' = vertical list with small posters (desktop sidebar) */
    variant?: 'standard' | 'compact'
    className?: string
    /** Optional callback when an item is clicked. If provided, prevents navigation and calls this instead. */
    onItemClick?: (itemId: string) => void
    /** Enable internal category filter dropdown */
    showCategoryFilter?: boolean
    /** Initial category to filter by (defaults to source item's category) */
    initialCategory?: string | null
}

export function RelatedItemsRow({
    sourceItemId,
    matchCount = 100, // Fetch many items since we filter client-side
    categoryFilter = null,
    variant = 'standard',
    className = '',
    onItemClick,
    showCategoryFilter = true,
    initialCategory = null
}: RelatedItemsRowProps) {
    const [items, setItems] = useState<RelatedItem[]>([])
    const [allItems, setAllItems] = useState<RelatedItem[]>([]) // Store all fetched items for filtering
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [visibleCount, setVisibleCount] = useState(5) // Show at least 5 initially
    const [fetchLimit, setFetchLimit] = useState(matchCount)
    const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all')
    const [explanations, setExplanations] = useState<Map<string, SimilarityExplanation>>(new Map())
    const [loadingExplanations, setLoadingExplanations] = useState(false)
    const [noMoreItems, setNoMoreItems] = useState(false)

    // Show all categories from CATEGORY_LABELS, not just those in fetched items
    // This ensures users can explore all category types
    const availableCategories = useMemo(() => {
        return Object.keys(CATEGORY_LABELS).sort()
    }, [])

    // Filter items based on selected category
    const filteredItems = useMemo(() => {
        if (selectedCategory === 'all') {
            // Return all items sorted by similarity
            return allItems
        }
        return allItems.filter(item => item.category_type === selectedCategory)
    }, [allItems, selectedCategory])

    // Auto-fetch more items if the filtered category has fewer than 5 items
    useEffect(() => {
        const minItems = 5
        if (!loading && filteredItems.length < minItems && filteredItems.length > 0 && allItems.length === fetchLimit) {
            // Try fetching more to get at least 5 items for this category
            setFetchLimit(prev => prev + 12)
        }
    }, [filteredItems.length, allItems.length, fetchLimit, loading])

    useEffect(() => {
        async function fetchRelatedItems() {
            setLoading(true)
            setError(null)

            try {
                // Use the standard client that has correct env vars
                const { createClient } = await import('@/lib/supabase/client')
                const supabase = createClient()

                // When using internal filter, fetch all categories; otherwise use provided filter
                const effectiveCategoryFilter = showCategoryFilter ? null : categoryFilter

                // Use the new Hybrid Scoring RPC
                const rpcCategoryFilter = null

                // Try enhanced RPC with reasons
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const enhancedResult = await (supabase.rpc as any)('find_hybrid_similar_items', {
                    source_item_id: sourceItemId,
                    match_count: fetchLimit,
                    category_filter: rpcCategoryFilter
                })

                if (enhancedResult.error) {
                    console.error('Hybrid RPC failed:', enhancedResult.error)
                    setError(enhancedResult.error.message)
                    return
                }

                const data = enhancedResult.data

                // Debug logging
                console.log('[RelatedItems] RPC returned', data?.length, 'items')
                console.log('[RelatedItems] Categories found:', [...new Set(data?.map((i: RelatedItem) => i.category_type) || [])])
                console.log('[RelatedItems] First 3 items:', data?.slice(0, 3))

                setAllItems(data || [])
            } catch (err) {
                console.error('Unexpected error:', err)
                setError('Failed to load related items')
            } finally {
                setLoading(false)
                setLoadingMore(false)
            }
        }

        if (sourceItemId) {
            fetchRelatedItems()
        } else {
            setLoading(false)
        }
    }, [sourceItemId, fetchLimit, categoryFilter, showCategoryFilter])

    // Fetch LLM-generated explanations for visible items
    useEffect(() => {
        async function fetchExplanations() {
            if (filteredItems.length === 0 || !sourceItemId) return

            // Prepare items with their shared traits context
            const itemsToExplain = visibleItems
                .filter(item => !explanations.has(item.id))
                .map(item => ({
                    id: item.id,
                    sharedTraits: item.shared_traits || []
                }))

            if (itemsToExplain.length === 0) return

            setLoadingExplanations(true)
            try {
                const newExplanations = await getBatchSimilarityExplanations(sourceItemId, itemsToExplain)
                setExplanations(prev => {
                    const merged = new Map(prev)
                    newExplanations.forEach((value, key) => merged.set(key, value))
                    return merged
                })
            } catch (err) {
                console.error('Failed to fetch similarity explanations:', err)
            } finally {
                setLoadingExplanations(false)
            }
        }

        fetchExplanations()
        // Note: explanations is intentionally excluded to prevent infinite loops
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredItems, visibleCount, sourceItemId, selectedCategory])

    const handleLoadMore = () => {
        const nextStep = 6
        const nextVisible = visibleCount + nextStep

        // Always show more items if we have them cached
        setVisibleCount(nextVisible)

        // If requesting more than we have, fetch more from DB
        if (nextVisible > allItems.length) {
            console.log('[RelatedItems] Fetching more items, current:', allItems.length, 'requested:', nextVisible, 'new limit:', fetchLimit + 12)
            setLoadingMore(true)
            setFetchLimit(prev => prev + 12)
        }
    }

    const handleItemClick = (itemId: string) => {
        if (onItemClick) {
            onItemClick(itemId)
        }
    }

    const visibleItems = filteredItems.slice(0, visibleCount)

    // Show "Load More" only if:
    // 1. We have more cached items to show, OR
    // 2. We might be able to fetch more from DB (haven't hit the limit)
    const hasMoreCached = visibleCount < filteredItems.length
    const mightHaveMoreInDB = allItems.length >= fetchLimit - 12 // Buffer for filtering
    const showLoadMore = filteredItems.length > 0 && (hasMoreCached || mightHaveMoreInDB)

    // Reset noMoreItems when category changes or new items load
    useEffect(() => {
        setNoMoreItems(false)
    }, [selectedCategory, allItems.length])

    // Don't render anything if no items and not loading
    if (!loading && allItems.length === 0) {
        return null
    }

    // Helper to get category label
    const getCategoryLabel = (categoryType: string): string => {
        return CATEGORY_LABELS[categoryType] || categoryType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }

    // Compact variant: Vertical list with small horizontal cards (for sidebar)
    if (variant === 'compact') {
        return (
            <div className={`pt-6 border-t border-white/5 ${className}`}>
                <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[10px] uppercase tracking-widest text-zinc-500 font-black flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Similar Items
                    </h5>
                    {showCategoryFilter && availableCategories.length > 1 && (
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger size="sm" className="h-6 w-auto min-w-[80px] text-[10px] border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-white">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-700">
                                <SelectItem value="all" className="text-xs text-zinc-300">All</SelectItem>
                                {availableCategories.map((cat) => (
                                    <SelectItem key={cat} value={cat} className="text-xs text-zinc-300">
                                        {getCategoryLabel(cat)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {loading && allItems.length === 0 ? (
                    // Skeleton loading state - vertical stack (initial load only)
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex gap-2 items-center">
                                <Skeleton className="w-12 h-16 rounded bg-zinc-800 flex-shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="w-full h-3 rounded bg-zinc-800" />
                                    <Skeleton className="w-12 h-2 rounded bg-zinc-800" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <p className="text-xs text-zinc-600">{error}</p>
                ) : (
                    // Vertical list of compact cards
                    <div className="flex flex-col gap-2">
                        {visibleItems.map((item) => {
                            const content = (
                                <>
                                    {/* Small poster */}
                                    <div className="relative w-10 h-14 rounded overflow-hidden bg-zinc-900 ring-1 ring-white/5 group-hover:ring-cyan-500/30 transition-all flex-shrink-0">
                                        {item.image_url ? (
                                            <Image
                                                src={item.image_url}
                                                alt={item.title}
                                                fill
                                                className="object-cover"
                                                sizes="40px"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Film className="w-4 h-4 text-zinc-700" />
                                            </div>
                                        )}
                                    </div>
                                    {/* Title and match % */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-zinc-400 truncate group-hover:text-white transition-colors leading-tight">
                                            {item.title}
                                        </p>
                                        <p className="text-[10px] text-cyan-500/80 font-medium mt-0.5">
                                            {Math.round(item.hybrid_score * 100)}% match
                                        </p>
                                    </div>
                                </>
                            )

                            // Build tooltip content showing why it's similar
                            // Use shared_traits from RPC (Hybrid logic)
                            const sharedTraits = item.shared_traits?.filter(Boolean) || []
                            const explanation = explanations.get(item.id)
                            const isLoadingExplanation = loadingExplanations && !explanation

                            const tooltipContent = (
                                <SimilarityTooltipContent
                                    title={item.title}
                                    releaseYear={item.release_year}
                                    runtime={item.runtime}
                                    voteAverage={item.vote_average}
                                    categoryType={item.category_type}
                                    similarity={item.hybrid_score} // Use hybrid score
                                    sharedTraits={sharedTraits}
                                    explanation={explanation}
                                    isLoading={isLoadingExplanation}
                                />
                            )

                            // Use button if onItemClick is provided, otherwise use Link
                            if (onItemClick) {
                                return (
                                    <TooltipProvider key={item.id} delayDuration={300}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => handleItemClick(item.id)}
                                                    className="flex gap-2.5 items-center group cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-white/5 transition-colors text-left w-full"
                                                >
                                                    {content}
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" align="start" sideOffset={12} collisionPadding={16} className="bg-zinc-900 border border-zinc-700 text-zinc-200 px-4 py-3 z-[9999] shadow-xl shadow-black/50 rounded-lg">
                                                <TooltipArrow className="fill-zinc-900" />
                                                {tooltipContent}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )
                            }

                            return (
                                <TooltipProvider key={item.id} delayDuration={300}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Link
                                                href={`/admin/data-browser?id=${item.id}`}
                                                className="flex gap-2.5 items-center group cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                            >
                                                {content}
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" align="start" sideOffset={12} collisionPadding={16} className="bg-zinc-900 border border-zinc-700 text-zinc-200 px-4 py-3 z-[9999] shadow-xl shadow-black/50 rounded-lg">
                                            <TooltipArrow className="fill-zinc-900" />
                                            {tooltipContent}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )
                        })}

                        {showLoadMore && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleLoadMore()
                                }}
                                disabled={loadingMore}
                                className="w-full text-xs text-cyan-500 hover:text-cyan-400 hover:underline py-2 transition-colors text-left mt-1 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {loadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
                                {loadingMore ? 'Loading...' : 'Load more items...'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // Standard variant: Horizontal scroll with vertical poster cards (for mobile/bottom)
    return (
        <div className={`space-y-3 ${className}`}>
            <div className="flex items-center justify-between">
                <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Similar Items
                </h5>
                {showCategoryFilter && availableCategories.length > 1 && (
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger size="sm" className="h-6 w-auto min-w-[80px] text-[10px] border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-white">
                            <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                            <SelectItem value="all" className="text-xs text-zinc-300">All</SelectItem>
                            {availableCategories.map((cat) => (
                                <SelectItem key={cat} value={cat} className="text-xs text-zinc-300">
                                    {getCategoryLabel(cat)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {loading && allItems.length === 0 ? (
                // Skeleton loading state - horizontal
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-24">
                            <Skeleton className="w-24 h-36 rounded-lg bg-zinc-800" />
                            <Skeleton className="w-20 h-3 mt-2 rounded bg-zinc-800" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <p className="text-xs text-zinc-600">{error}</p>
            ) : (
                // Horizontal scroll of related items
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent items-start">
                    {visibleItems.map((item) => {
                        const content = (
                            <>
                                <div className="relative w-24 h-36 rounded-lg overflow-hidden bg-zinc-900 ring-1 ring-white/5 group-hover:ring-cyan-500/30 transition-all duration-200">
                                    {item.image_url ? (
                                        <Image
                                            src={item.image_url}
                                            alt={item.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            sizes="96px"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Film className="w-8 h-8 text-zinc-700" />
                                        </div>
                                    )}
                                    {/* Similarity badge */}
                                    <div className={`absolute bottom-1 right-1 backdrop-blur-sm text-[9px] text-white font-medium px-1.5 py-0.5 rounded shadow-lg ${(item.hybrid_score * 100) > 80 ? 'bg-green-500/80' :
                                        (item.hybrid_score * 100) > 50 ? 'bg-amber-500/80' : 'bg-red-500/80'
                                        }`}>
                                        {Math.max(0, Math.min(100, Math.round(item.hybrid_score * 100)))}%
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-400 mt-1.5 truncate group-hover:text-white transition-colors">
                                    {item.title}
                                </p>
                            </>
                        )

                        // Use button if onItemClick is provided, otherwise use Link
                        if (onItemClick) {
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleItemClick(item.id)}
                                    className="flex-shrink-0 w-24 group cursor-pointer text-left"
                                >
                                    {content}
                                </button>
                            )
                        }

                        return (
                            <Link
                                key={item.id}
                                href={`/search?id=${item.id}`}
                                className="flex-shrink-0 w-24 group cursor-pointer"
                            >
                                {content}
                            </Link>
                        )
                    })}

                    {showLoadMore && (
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                handleLoadMore()
                            }}
                            disabled={loading}
                            className="flex-shrink-0 w-24 h-36 border border-white/5 rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors group text-zinc-500 hover:text-white hover:border-white/10"
                        >
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                {loading ? <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-white animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            </div>
                            <span className="text-xs font-medium">{loading ? 'Loading...' : 'Show more'}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

