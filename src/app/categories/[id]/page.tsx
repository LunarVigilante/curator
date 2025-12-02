import { getCategory } from '@/lib/actions/categories'
import { getItems } from '@/lib/actions/items'
import TierListBoard from '@/components/rating/TierListBoard'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import EditCategoryButton from './EditCategoryButton'
import RecommendationDialog from '@/components/dialogs/RecommendationDialog'
import AddItemDialog from '@/components/dialogs/AddItemDialog'

export default async function CategoryPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    const category = await getCategory(params.id)
    const items = await getItems(params.id)

    if (!category) {
        return <div>Category not found</div>
    }

    return (
        <div className="container mx-auto py-6">
            <div className="mb-6">
                <Link href="/">
                    <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent hover:text-primary">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Categories
                    </Button>
                </Link>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                            {category.name}
                            <EditCategoryButton category={category} />
                        </h1>
                        <p className="text-muted-foreground text-lg">{category.description}</p>
                    </div>
                    <div className="flex gap-2">
                        <AddItemDialog categoryId={category.id} categoryName={category.name} />
                        <RecommendationDialog categoryId={category.id} categoryName={category.name} />
                    </div>
                </div>
            </div>

            <TierListBoard
                items={items}
                categoryId={category.id}
                categoryMetadata={category.metadata}
            />
        </div>
    )
}
