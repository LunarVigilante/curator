'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Heart, LayoutGrid, LayoutList, Grip, Settings2 } from 'lucide-react'
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

interface LikedClientProps {
    categories: Category[]
    interactionStatus: Record<string, { liked: boolean; saved: boolean }>
    likeCounts: Record<string, number>
}

export function LikedClient({ categories, interactionStatus, likeCounts }: LikedClientProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('standard')

    // Dynamic grid classes
    const gridClasses = {
        compact: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4',
        standard: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6',
        comfort: 'grid-cols-1 md:grid-cols-3 gap-8'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Heart className="h-8 w-8 text-red-400" />
                        Liked Collections
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Collections you've liked ({categories.length})
                    </p>
                </div>

                {/* View Mode Toggle */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Settings2 className="h-4 w-4" />
                            View
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Grid Density
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setViewMode('compact')} className="cursor-pointer">
                            <Grip className="h-4 w-4 mr-2" />
                            Compact
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setViewMode('standard')} className="cursor-pointer">
                            <LayoutGrid className="h-4 w-4 mr-2" />
                            Standard
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setViewMode('comfort')} className="cursor-pointer">
                            <LayoutList className="h-4 w-4 mr-2" />
                            Comfortable
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>

            {/* Collection Grid */}
            {categories.length === 0 ? (
                <div className="text-center py-20">
                    <Heart className="h-16 w-16 mx-auto text-zinc-700 mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No liked collections yet</h2>
                    <p className="text-muted-foreground mb-6">
                        Browse and like collections to see them here
                    </p>
                    <Link href="/browse">
                        <Button>Browse Collections</Button>
                    </Link>
                </div>
            ) : (
                <div className={cn("grid transition-all duration-300", gridClasses[viewMode])}>
                    {categories.map((cat) => {
                        const status = interactionStatus[cat.id] || { liked: false, saved: false }
                        return (
                            <Link key={cat.id} href={`/categories/${cat.id}`} className="group block h-full">
                                <CollectionCard
                                    category={{
                                        ...cat,
                                        itemCount: cat.items?.length || 0
                                    }}
                                    initialLiked={status.liked}
                                    initialSaved={status.saved}
                                    initialLikeCount={likeCounts[cat.id] || 0}
                                    viewMode={viewMode}
                                />
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
