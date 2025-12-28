'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bookmark, LayoutGrid, LayoutList, Grip, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
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

interface BookmarksClientProps {
    categories: Category[]
    interactionStatus: Record<string, { liked: boolean; saved: boolean }>
    likeCounts: Record<string, number>
}

export function BookmarksClient({ categories, interactionStatus, likeCounts }: BookmarksClientProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('standard')

    // Dynamic grid classes
    const gridClasses = {
        compact: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4',
        standard: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6',
        comfort: 'grid-cols-1 md:grid-cols-3 gap-8'
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Bookmark className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold font-serif tracking-tight text-white mb-1">My Bookmarks</h1>
                            <p className="text-muted-foreground text-sm">{categories.length} saved collections</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            {categories.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border border-dashed border-white/10 rounded-xl">
                    <Bookmark className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
                    <p className="text-lg font-medium text-zinc-400 mb-2">No bookmarks yet</p>
                    <p className="text-sm text-zinc-500 mb-4">Save collections you want to revisit by clicking the bookmark icon.</p>
                    <Link href="/browse" className="inline-block text-blue-400 hover:text-blue-300 text-sm font-medium">
                        Browse Collections →
                    </Link>
                </div>
            ) : (
                <div className={cn("grid transition-all duration-300", gridClasses[viewMode])}>
                    {categories.map((cat) => {
                        const status = interactionStatus[cat.id] || { liked: false, saved: true }
                        const count = likeCounts[cat.id] || 0
                        return (
                            <Link key={cat.id} href={`/categories/${cat.id}`} className="group block h-full">
                                <CollectionCard
                                    category={cat}
                                    viewMode={viewMode}
                                    initialLiked={status.liked}
                                    initialSaved={status.saved}
                                    initialLikeCount={count}
                                />
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
