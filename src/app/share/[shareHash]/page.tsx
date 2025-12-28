import { getShareCardByHash } from '@/lib/actions/sharing'
import { notFound } from 'next/navigation'
import { ShareCard } from '@/components/sharing/ShareCard'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight, Eye } from 'lucide-react'
import type { Metadata } from 'next'

interface SharePageProps {
    params: Promise<{ shareHash: string }>
}

// Generate OG meta tags for social sharing
export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
    const { shareHash } = await params
    const shareCard = await getShareCardByHash(shareHash)

    if (!shareCard) {
        return { title: 'Share Not Found' }
    }

    const curatorName = shareCard.curator.displayName || shareCard.curator.name
    const title = `${shareCard.category.name} Rankings by ${curatorName}`
    const description = `Check out ${curatorName}'s top picks: ${shareCard.topItems.map((i, idx) => `${idx + 1}. ${i.name}`).join(', ')}`

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            // If we had image generation, we'd add the image URL here
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        }
    }
}

export default async function SharePage({ params }: SharePageProps) {
    const { shareHash } = await params
    const shareCard = await getShareCardByHash(shareHash)

    if (!shareCard) {
        notFound()
    }

    const curatorName = shareCard.curator.displayName || shareCard.curator.name

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-6">
                {/* Share Card Preview */}
                <div className="w-full aspect-square">
                    <ShareCard data={shareCard} template="default" />
                </div>

                {/* Call to Action */}
                <div className="text-center space-y-4">
                    <p className="text-zinc-400">
                        Curated by <span className="text-white font-medium">{curatorName}</span>
                    </p>

                    <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                        <Eye className="w-4 h-4" />
                        <span>{shareCard.viewCount} views</span>
                    </div>

                    <Link href={`/categories/${shareCard.category.id}`}>
                        <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500">
                            View Full Collection
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>

                    <div className="pt-4 border-t border-white/5">
                        <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">
                            Create your own rankings on Curator →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
