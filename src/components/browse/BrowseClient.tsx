'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from "@/components/ui/card"
import { Lock, Search, ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Grip, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { CollectionCard } from './CollectionCard'

type ViewMode = 'compact' | 'standard' | 'comfort'

interface Category {
    id: string
    name: string
    image: string | null
    isPublic: boolean
    owner: {
        id: string
        name: string | null
        image: string | null
    } | null
    itemCount?: number
    metadata?: string | null
    items?: { id: string }[]
}

interface BrowseClientProps {
    categories: Category[]
    query: string
    metadata: {
        currentPage: number
        totalPages: number
        hasPreviousPage: boolean
        hasNextPage: boolean
    }
    type?: string
    sort?: string
    interactionStatus?: Record<string, { liked: boolean; saved: boolean }>
    likeCounts?: Record<string, number>
    tagsMap?: Record<string, { id: string; tag: string; isAdminOnly: boolean; categoryId: string; addedBy: string | null; createdAt: Date }[]>
    isAdmin?: boolean
}

export function BrowseClient({
    categories,
    query,
    metadata,
    type = 'All',
    sort = 'newest',
    interactionStatus = {},
    likeCounts = {},
    tagsMap = {},
    isAdmin = false
}: BrowseClientProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('standard')
    const [showPrivate, setShowPrivate] = useState(true) // Admin toggle for private collections
    const router = useRouter()
    const searchParams = useSearchParams()

    const updateParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value && value !== 'All') {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        // Reset page on filter change if not page param
        if (key !== 'page') params.delete('page')

        router.push(`/browse?${params.toString()}`)
    }

    // Dynamic grid classes
    const gridClasses = {
        compact: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4',
        standard: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6',
        comfort: 'grid-cols-1 md:grid-cols-3 gap-8'
    }

    const categoriesList = ['All', 'Movies', 'TV Shows', 'Anime', 'Video Games', 'Books', 'Music', 'Audiobooks', 'Podcasts', 'Board Games', 'Comics']

    // Filter categories based on admin toggle
    const filteredCategories = isAdmin && !showPrivate
        ? categories.filter(c => c.isPublic)
        : categories

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-serif tracking-tight text-white mb-2">Browse Collections</h1>
                        <p className="text-muted-foreground">Discover lists curated by the community.</p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {/* View Settings Control */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0 bg-black/20 border-white/10 hover:bg-white/10">
                                    <Settings2 className="w-4 h-4 text-zinc-400" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-zinc-800">
                                <DropdownMenuLabel className="text-zinc-400 text-xs uppercase tracking-wider">View Layout</DropdownMenuLabel>

                                <DropdownMenuItem onClick={() => setViewMode('compact')} className="gap-2 cursor-pointer focus:bg-white/5">
                                    <Grip className="w-4 h-4 text-zinc-500" />
                                    <span className={cn("flex-1", viewMode === 'compact' && "text-blue-400")}>Compact</span>
                                    {viewMode === 'compact' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => setViewMode('standard')} className="gap-2 cursor-pointer focus:bg-white/5">
                                    <LayoutGrid className="w-4 h-4 text-zinc-500" />
                                    <span className={cn("flex-1", viewMode === 'standard' && "text-blue-400")}>Standard</span>
                                    {viewMode === 'standard' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => setViewMode('comfort')} className="gap-2 cursor-pointer focus:bg-white/5">
                                    <LayoutList className="w-4 h-4 text-zinc-500" />
                                    <span className={cn("flex-1", viewMode === 'comfort' && "text-blue-400")}>Comfort</span>
                                    {viewMode === 'comfort' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </DropdownMenuItem>

                                {isAdmin && (
                                    <>
                                        <DropdownMenuSeparator className="bg-zinc-800 my-1" />
                                        <DropdownMenuLabel className="text-zinc-400 text-xs uppercase tracking-wider">Admin</DropdownMenuLabel>
                                        <DropdownMenuItem
                                            onClick={() => setShowPrivate(!showPrivate)}
                                            className="gap-2 cursor-pointer focus:bg-white/5"
                                        >
                                            <Lock className="w-4 h-4 text-zinc-500" />
                                            <span className="flex-1">{showPrivate ? 'Hide Private' : 'Show Private'}</span>
                                            {showPrivate && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Sort Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="shrink-0 bg-black/20 border-white/10 hover:bg-white/10 text-zinc-300 gap-2">
                                    <span className="text-xs uppercase tracking-wider font-medium opacity-60">Sort:</span>
                                    {sort === 'newest' && 'Newest'}
                                    {sort === 'popular' && 'Popular'}
                                    {sort === 'rated' && 'Top Rated'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 bg-zinc-950 border-zinc-800">
                                <DropdownMenuItem onClick={() => updateParam('sort', 'newest')} className={cn("cursor-pointer focus:bg-white/5", sort === 'newest' && "text-blue-400")}>
                                    Newest
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateParam('sort', 'popular')} className={cn("cursor-pointer focus:bg-white/5", sort === 'popular' && "text-blue-400")}>
                                    Most Popular
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateParam('sort', 'rated')} className={cn("cursor-pointer focus:bg-white/5", sort === 'rated' && "text-blue-400")}>
                                    Top Rated
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Search Form */}
                        <form action="/browse" method="GET" className="relative flex-1 md:w-[240px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                name="q"
                                defaultValue={query}
                                placeholder="Search..."
                                className="w-full pl-9 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-white placeholder:text-zinc-500 border-white/10 bg-black/20"
                            />
                            {/* Preserve other params */}
                            {type !== 'All' && <input type="hidden" name="type" value={type} />}
                            {sort !== 'newest' && <input type="hidden" name="sort" value={sort} />}
                        </form>
                    </div>
                </div>

                {/* Category Filters */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 mask-fade-right">
                    {categoriesList.map((catType) => {
                        const isSelected = type === catType || (catType === 'All' && !type) || (type === 'All' && catType === 'All')
                        return (
                            <button
                                key={catType}
                                onClick={() => updateParam('type', catType)}
                                className={cn(
                                    "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
                                    isSelected
                                        ? "bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]"
                                        : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                )}
                            >
                                {catType}
                            </button>
                        )
                    })}
                </div>
            </header>

            {categories.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border border-dashed border-white/10 rounded-xl">
                    <p>No collections found matching "{query}"</p>
                    {query && (
                        <Link href="/browse" className="mt-4 inline-block text-blue-400 hover:text-blue-300">
                            Clear Search
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    <div className={cn("grid transition-all duration-300", gridClasses[viewMode])}>
                        {filteredCategories.map((cat) => {
                            const status = interactionStatus[cat.id] || { liked: false, saved: false }
                            const count = likeCounts[cat.id] || 0
                            const catTags = (tagsMap[cat.id] || []).map(t => ({
                                id: t.id,
                                tag: t.tag,
                                isAdminOnly: t.isAdminOnly
                            }))
                            return (
                                <Link key={cat.id} href={`/categories/${cat.id}`} className="group block h-full">
                                    <CollectionCard
                                        category={cat}
                                        viewMode={viewMode}
                                        initialLiked={status.liked}
                                        initialSaved={status.saved}
                                        initialLikeCount={count}
                                        tags={catTags}
                                    />
                                </Link>
                            )
                        })}
                    </div>

                    {/* Pagination */}
                    {(metadata.totalPages > 1) && (
                        <div className="flex items-center justify-center gap-4 pt-8">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!metadata.hasPreviousPage}
                                asChild
                            >
                                <Link
                                    href={`/browse?q=${query}&page=${metadata.currentPage - 1}`}
                                    className={!metadata.hasPreviousPage ? 'pointer-events-none opacity-50' : ''}
                                >
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Previous
                                </Link>
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {metadata.currentPage} of {metadata.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!metadata.hasNextPage}
                                asChild
                            >
                                <Link
                                    href={`/browse?q=${query}&page=${metadata.currentPage + 1}`}
                                    className={!metadata.hasNextPage ? 'pointer-events-none opacity-50' : ''}
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                </Link>
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
