'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Users, Star, Trophy, Sparkles } from 'lucide-react'
import { type LeaderboardItem, type LeaderboardTab } from '@/lib/actions/leaderboards'
import { cn } from '@/lib/utils'

interface LeaderboardContentProps {
    initialItems: LeaderboardItem[]
    categories: string[]
    initialTab: LeaderboardTab
    initialCategory?: string
}

export default function LeaderboardContent({
    initialItems,
    categories,
    initialTab,
    initialCategory
}: LeaderboardContentProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const [tab, setTab] = useState<LeaderboardTab>(initialTab)
    const [category, setCategory] = useState(initialCategory || 'all')
    const [items] = useState(initialItems)

    function handleTabChange(newTab: string) {
        setTab(newTab as LeaderboardTab)
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', newTab)
            if (category !== 'all') params.set('category', category)
            router.push(`/leaderboards?${params.toString()}`)
        })
    }

    function handleCategoryChange(newCategory: string) {
        setCategory(newCategory)
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', tab)
            if (newCategory !== 'all') {
                params.set('category', newCategory)
            } else {
                params.delete('category')
            }
            router.push(`/leaderboards?${params.toString()}`)
        })
    }

    const tabDescriptions: Record<LeaderboardTab, string> = {
        community: 'Ranked by user votes using Borda Count + ELO',
        critics: 'Ranked by IMDB, Rotten Tomatoes, and Metacritic',
        curator: 'Hybrid score using TOPSIS algorithm',
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <Tabs value={tab} onValueChange={handleTabChange}>
                    <TabsList className="bg-zinc-900 border border-zinc-800">
                        <TabsTrigger value="community" className="gap-2">
                            <Users className="h-4 w-4" />
                            Community
                        </TabsTrigger>
                        <TabsTrigger value="critics" className="gap-2">
                            <Star className="h-4 w-4" />
                            Critics
                        </TabsTrigger>
                        <TabsTrigger value="curator" className="gap-2">
                            <Sparkles className="h-4 w-4" />
                            Curator Score
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <Select value={category} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>
                                {formatCategoryName(cat)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground">
                {tabDescriptions[tab]}
            </p>

            {/* Leaderboard List */}
            <div className={cn(
                "space-y-3 transition-opacity duration-200",
                isPending && "opacity-50"
            )}>
                {items.length === 0 ? (
                    <Card className="p-12 text-center bg-zinc-900/50 border-zinc-800">
                        <Trophy className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
                        <p className="text-muted-foreground">
                            No items found. Start rating to see the leaderboard!
                        </p>
                    </Card>
                ) : (
                    items.map(item => (
                        <LeaderboardRow key={item.id} item={item} tab={tab} />
                    ))
                )}
            </div>
        </div>
    )
}

function LeaderboardRow({ item, tab }: { item: LeaderboardItem; tab: LeaderboardTab }) {
    const rankBadgeClass = item.rank <= 3
        ? item.rank === 1 ? 'bg-yellow-500 text-black'
            : item.rank === 2 ? 'bg-zinc-300 text-black'
                : 'bg-amber-700 text-white'
        : 'bg-zinc-800 text-zinc-300'

    return (
        <Link href={`/browse/${item.globalItemId}`}>
            <Card className="flex items-center gap-4 p-3 bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all group">
                {/* Rank */}
                <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                    rankBadgeClass
                )}>
                    {item.rank}
                </div>

                {/* Image */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                    {item.imageUrl ? (
                        <Image
                            src={item.imageUrl}
                            alt={item.title}
                            width={56}
                            height={56}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">
                            No img
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                        {item.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {formatCategoryName(item.categoryType)}
                        </Badge>
                        {item.releaseYear && (
                            <span>{item.releaseYear}</span>
                        )}
                        {item.userCount > 0 && (
                            <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {item.userCount}
                            </span>
                        )}
                    </div>
                </div>

                {/* Scores */}
                <div className="flex items-center gap-3 shrink-0">
                    {tab === 'community' && (
                        <>
                            {item.bordaScore && (
                                <ScoreBadge label="Borda" value={item.bordaScore.toFixed(1)} color="violet" />
                            )}
                            {item.eloScore && (
                                <ScoreBadge label="ELO" value={item.eloScore.toString()} color="blue" />
                            )}
                        </>
                    )}
                    {tab === 'critics' && (
                        <>
                            {item.voteAverage && (
                                <ScoreBadge label="TMDB" value={item.voteAverage.toFixed(1)} color="green" />
                            )}
                            {item.imdbRating && (
                                <ScoreBadge label="IMDB" value={item.imdbRating} color="yellow" />
                            )}
                            {item.metacriticRating && (
                                <ScoreBadge label="Meta" value={item.metacriticRating.toString()} color="blue" />
                            )}
                        </>
                    )}
                    {tab === 'curator' && item.curatorScore && (
                        <ScoreBadge label="Curator" value={item.curatorScore.toString()} color="fuchsia" />
                    )}
                </div>
            </Card>
        </Link>
    )
}

function ScoreBadge({ label, value, color }: { label: string; value: string; color: string }) {
    const colorClasses: Record<string, string> = {
        violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
        blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        green: 'bg-green-500/20 text-green-400 border-green-500/30',
        yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        fuchsia: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
    }

    return (
        <div className={cn(
            "flex flex-col items-center px-2 py-1 rounded border",
            colorClasses[color] || colorClasses.blue
        )}>
            <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
            <span className="font-bold text-sm">{value}</span>
        </div>
    )
}

function formatCategoryName(categoryType: string): string {
    return categoryType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase())
}
