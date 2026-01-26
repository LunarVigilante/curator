import { Suspense } from 'react'
import { getLeaderboard, getLeaderboardCategories, type LeaderboardTab } from '@/lib/actions/leaderboards'
import LeaderboardContent from './LeaderboardContent'

export const metadata = {
    title: 'Leaderboards | Curator',
    description: 'Discover the highest-rated items across our community',
}

interface LeaderboardsPageProps {
    searchParams: Promise<{
        tab?: LeaderboardTab
        category?: string
    }>
}

export default async function LeaderboardsPage({ searchParams }: LeaderboardsPageProps) {
    const params = await searchParams
    const tab = (params.tab || 'community') as LeaderboardTab
    const categoryType = params.category || undefined

    // Fetch data in parallel
    const [items, categories] = await Promise.all([
        getLeaderboard(tab, { categoryType, limit: 50 }),
        getLeaderboardCategories()
    ])

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-serif tracking-tight mb-2">
                    Leaderboards
                </h1>
                <p className="text-muted-foreground">
                    Discover the highest-rated items as ranked by our community and critics
                </p>
            </header>

            <Suspense fallback={<LeaderboardSkeleton />}>
                <LeaderboardContent
                    initialItems={items}
                    categories={categories}
                    initialTab={tab}
                    initialCategory={categoryType}
                />
            </Suspense>
        </div>
    )
}

function LeaderboardSkeleton() {
    return (
        <div className="space-y-4">
            <div className="h-12 bg-zinc-800/50 rounded-lg animate-pulse" />
            <div className="grid gap-3">
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
                ))}
            </div>
        </div>
    )
}
