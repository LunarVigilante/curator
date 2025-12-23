'use client'

import { useState } from 'react'
import { getCategories } from '@/lib/actions/categories'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import CategoryGrid from '@/components/CategoryGrid'
import ManageCategoriesDialog from '@/components/dialogs/ManageCategoriesDialog'

export default function HomePageClient({ categories }: { categories: Awaited<ReturnType<typeof getCategories>> }) {
    const [isManaging, setIsManaging] = useState(false)
    const [categoryList, setCategoryList] = useState(categories)

    const loadCategories = async () => {
        const updated = await getCategories()
        setCategoryList(updated)
    }

    return (
        <div className="container mx-auto py-10">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Featured Categories</h1>
                <Button onClick={() => setIsManaging(true)} variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Categories
                </Button>
            </div>

            <CategoryGrid categories={categoryList} bentoLayout={true} onSuccess={loadCategories} />

            <ManageCategoriesDialog
                categories={categoryList}
                open={isManaging}
                onOpenChange={setIsManaging}
                onSuccess={loadCategories}
            />
        </div>
    )
}
