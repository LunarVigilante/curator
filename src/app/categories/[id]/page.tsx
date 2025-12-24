import { getCategory } from '@/lib/actions/categories'
import { getItems } from '@/lib/actions/items'
import { getCustomRanks } from '@/lib/actions/customRanks'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import CategoryView from './CategoryView'
// import { PageBackground } from '@/components/ui/PageBackground'

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

    const isOwner = true // No-login mode: everyone is an owner for now

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
            />
        </>
    )
}
