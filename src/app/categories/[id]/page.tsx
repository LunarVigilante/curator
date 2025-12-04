import { getCategory } from '@/lib/actions/categories'
import { getItems } from '@/lib/actions/items'
import TierListBoard from '@/components/rating/TierListBoard'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import EditCategoryButton from './EditCategoryButton'
import AddItemDialog from '@/components/dialogs/AddItemDialog'
import CustomRanksButton from './CustomRanksButton'
import { getCustomRanks } from '@/lib/actions/customRanks'
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton'

export default async function CategoryPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    const category = await getCategory(params.id)
    const items = await getItems(params.id)
    const customRanks = await getCustomRanks(params.id) as Array<{
        id: string
        name: string
        sentiment: 'positive' | 'neutral' | 'negative'
        color: string | null
        sortOrder: number
    }>

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
                        <AnalyzeButton categoryId={category.id} />
                        <CustomRanksButton categoryId={category.id} />
                        <AddItemDialog categoryId={category.id} categoryName={category.name} />
                    </div>
                </div>
            </div>

            <TierListBoard
                items={items}
                categoryId={category.id}
                categoryMetadata={category.metadata}
                customRanks={customRanks}
            />
        </div>
    )
}
