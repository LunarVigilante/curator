'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { Pencil } from 'lucide-react'
import EditCategoryDialog from '@/components/dialogs/EditCategoryDialog'
import CategoryPlaceholder from '@/components/CategoryPlaceholder'

type Category = {
    id: string
    name: string
    description: string | null
    image: string | null
    color: string | null
    metadata: string | null
    createdAt: Date | null
}

export default function CategoryGrid({ categories, tileSize = 300 }: { categories: Category[], tileSize?: number }) {
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)

    return (
        <>
            <div className="flex flex-wrap justify-center gap-6 w-full">
                {categories.map((category) => (
                    <div
                        key={category.id}
                        className="relative group w-full"
                        style={{ maxWidth: `${tileSize}px`, minWidth: '200px', flex: `1 1 ${tileSize}px` }}
                    >
                        <Link href={`/categories/${category.id}`} className="block h-full">
                            <Card className="h-full overflow-hidden border-0 bg-muted/20 hover:bg-muted/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group-hover:ring-2 ring-primary/20">
                                <CardContent className="p-0 relative aspect-video overflow-hidden">
                                    {category.image ? (
                                        <Image
                                            src={category.image}
                                            alt={category.name}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <CategoryPlaceholder name={category.name} color={category.color} />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6 text-left">
                                        <h3 className="text-2xl font-bold text-white mb-1 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">{category.name}</h3>
                                        <p className="text-white/80 text-sm line-clamp-2 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75">
                                            {category.description || 'No description available'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Edit Button */}
                        <Button
                            size="icon"
                            variant="secondary"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setEditingCategory(category)
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

            {editingCategory && (
                <EditCategoryDialog
                    category={editingCategory}
                    open={!!editingCategory}
                    onOpenChange={(open) => !open && setEditingCategory(null)}
                />
            )}
        </>
    )
}
