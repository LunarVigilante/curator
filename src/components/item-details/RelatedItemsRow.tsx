'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Film, Sparkles } from 'lucide-react'

interface RelatedItem {
    id: string
    title: string
    image_url: string | null
    category_type: string | null
    similarity: number
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
}

export function RelatedItemsRow({
    sourceItemId,
    matchCount = 12, // Default initial batch
    categoryFilter = null,
    variant = 'standard',
    className = '',
    onItemClick
}: RelatedItemsRowProps) {
    const [items, setItems] = useState<RelatedItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [visibleCount, setVisibleCount] = useState(6)
    const [fetchLimit, setFetchLimit] = useState(matchCount)

    useEffect(() => {
        async function fetchRelatedItems() {
            setLoading(true)
            setError(null)

            try {
                // Use the standard client that has correct env vars
                const { createClient } = await import('@/lib/supabase/client')
                const supabase = createClient()

                const { data, error: rpcError } = await supabase.rpc('find_similar_items', {
                    source_item_id: sourceItemId,
                    match_count: fetchLimit, // Use dynamic limit
                    category_filter: categoryFilter
                })

                if (rpcError) {
                    console.error('Error fetching related items:', rpcError)
                    setError(rpcError.message)
                    return
                }

                setItems(data || [])
            } catch (err) {
                console.error('Unexpected error:', err)
                setError('Failed to load related items')
            } finally {
                setLoading(false)
            }
        }

        if (sourceItemId) {
            fetchRelatedItems()
        } else {
            setLoading(false)
        }
    }, [sourceItemId, fetchLimit, categoryFilter])

    const handleLoadMore = () => {
        const nextStep = 6
        const nextVisible = visibleCount + nextStep

        // precise "has more in DB" check isn't easy without count, 
        // effectively if we showed everything we fetched, try fetching more
        if (nextVisible > items.length) {
            setFetchLimit(prev => prev + 12)
        }
        setVisibleCount(nextVisible)
    }

    const handleItemClick = (itemId: string) => {
        if (onItemClick) {
            onItemClick(itemId)
        }
    }

    const visibleItems = items.slice(0, visibleCount)
    // Show "Load More" if we have more locally OR if we reached our fetch limit (implying there might be more in DB)
    const showLoadMore = items.length > visibleCount || (items.length === fetchLimit && items.length > 0)

    // Don't render anything if no items and not loading
    if (!loading && items.length === 0) {
        return null
    }

    // Compact variant: Vertical list with small horizontal cards (for sidebar)
    if (variant === 'compact') {
        return (
            <div className={`pt-6 border-t border-white/5 ${className}`}>
                <h5 className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mb-4 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> Similar Items
                </h5>

                {loading && items.length === 0 ? (
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
                                            {Math.round(item.similarity * 100)}% match
                                        </p>
                                    </div>
                                </>
                            )

                            // Use button if onItemClick is provided, otherwise use Link
                            if (onItemClick) {
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleItemClick(item.id)}
                                        className="flex gap-2.5 items-center group cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-white/5 transition-colors text-left w-full"
                                    >
                                        {content}
                                    </button>
                                )
                            }

                            return (
                                <Link
                                    key={item.id}
                                    href={`/admin/data-browser?id=${item.id}`}
                                    className="flex gap-2.5 items-center group cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-white/5 transition-colors"
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
                                className="w-full text-xs text-cyan-500 hover:text-cyan-400 hover:underline py-2 transition-colors text-left mt-1 disabled:opacity-50"
                            >
                                {loading ? 'Loading...' : 'Load more items...'}
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
            <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Similar Items
            </h5>

            {loading && items.length === 0 ? (
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
                                    <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm text-[9px] text-white font-medium px-1.5 py-0.5 rounded shadow-lg">
                                        {Math.round(item.similarity * 100)}%
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

