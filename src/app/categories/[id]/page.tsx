import { getCategory } from '@/lib/actions/categories'
import { getItems } from '@/lib/actions/items'
import { getCustomRanks } from '@/lib/actions/customRanks'
import { getUserById } from '@/lib/actions/users'
import { getInteractionStatus, getLikeCount, getSaveCount } from '@/lib/actions/interactions'
import { getChallengeStatus } from '@/lib/actions/challenges'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import CategoryView from './CategoryView'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export default async function CategoryPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    const category = await getCategory(params.id)
    // Pass 0 for limit to get ALL items (unlimited)
    const { items } = await getItems(undefined, 1, 0, params.id)
    const customRanks = await getCustomRanks(params.id) as any

    if (!category) {
        return (
            <div className="container mx-auto py-20 flex justify-center">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold">Category Not Found</h1>
                    <p className="text-muted-foreground">The category you are looking for does not exist or has been deleted.</p>
                    <Link href="/">
                        <Button>Return to Home</Button>
                    </Link>
                </div>
            </div>
        )
    }

    // Check if current user is owner OR is admin
    const session = await auth.api.getSession({ headers: await headers() })
    const userId = session?.user?.id
    const userRole = (session?.user as any)?.role

    // Separate ownership and admin status for explicit permission handling
    const isOwner = userId === category.userId
    const isAdmin = userRole === 'ADMIN' || userRole === 'admin'

    // Fetch Category Owner for Share Card
    let categoryOwner = null;
    if (category.userId) {
        const owner = await getUserById(category.userId);
        if (owner) {
            categoryOwner = { id: owner.id, name: owner.name, image: owner.image };
        }
    }

    // Fetch interaction data AND challenge status
    const [interactionStatus, likeCount, saveCount, challengeStatus] = await Promise.all([
        getInteractionStatus(params.id),
        getLikeCount(params.id),
        getSaveCount(params.id),
        userId ? getChallengeStatus(userId, params.id) : Promise.resolve(null)
    ])

    return (
        <>
            {/* Blended Overlay Layer (Local to Category) */}
            {category.image && (
                <div
                    className="fixed inset-0 z-[1] bg-cover bg-center opacity-40 mix-blend-overlay pointer-events-none transition-all duration-1000"
                    style={{
                        backgroundImage: `url(${category.image})`,
                        maskImage: 'linear-gradient(to bottom, black 0%, transparent 90%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 90%)'
                    }}
                />
            )}

            <CategoryView
                category={category}
                items={items}
                customRanks={customRanks}
                isOwner={isOwner}
                isAdmin={isAdmin}
                categoryOwner={categoryOwner}
                initialLiked={interactionStatus.liked}
                initialSaved={interactionStatus.saved}
                initialLikeCount={likeCount}
                initialSaveCount={saveCount}
                challengeStatus={challengeStatus}
            />
        </>
    )
}


