'use client'

import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import ItemPlaceholder from '@/components/ItemPlaceholder'
import { RatingDisplay } from '@/components/rating/RatingDisplay'

type Item = {
    id: string
    name: string
    description: string | null
    image: string | null
    categoryId: string | null
    category?: string
    tags: { id: string; name: string }[]
    ratings: { id: string; value: number; tier: string | null; type: string }[]
}

export default function ItemGrid({ items, gridCols = 5 }: { items: Item[], gridCols?: number }) {
    const getGridClass = (cols: number) => {
        switch (cols) {
            case 2: return 'grid-cols-2'
            case 3: return 'grid-cols-2 sm:grid-cols-3'
            case 4: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
            case 5: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
            case 6: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
            case 7: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7'
            case 8: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'
            default: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
        }
    }

    return (
        <div className={`grid ${getGridClass(gridCols)} gap-4`}>
            {items.map((item) => (
                <Link key={item.id} href={`/items/${item.id}`} className="block h-full group">
                    <Card className="h-full overflow-hidden border-0 bg-muted/20 hover:bg-muted/40 transition-all duration-200 hover:-translate-y-1 hover:shadow-md relative">
                        {item.ratings[0] && (
                            <div className="absolute top-2 right-2 z-10">
                                <RatingDisplay rating={item.ratings[0]} className="shadow-sm" />
                            </div>
                        )}
                        <CardContent className="p-0 flex flex-col h-full">
                            <div className="relative aspect-[2/3] overflow-hidden">
                                {item.image ? (
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                ) : (
                                    <ItemPlaceholder name={item.name} className="w-full h-full" />
                                )}
                            </div>
                            <div className="p-3 flex flex-col flex-1">
                                <h3 className="font-semibold truncate mb-1" title={item.name}>{item.name}</h3>
                                {item.category && (
                                    <p className="text-xs text-muted-foreground mb-2">{item.category}</p>
                                )}
                                <div className="mt-auto flex flex-wrap gap-1">
                                    {item.tags.slice(0, 3).map(tag => (
                                        <Badge key={tag.id} variant="secondary" className="text-[10px] px-1 h-5">
                                            {tag.name}
                                        </Badge>
                                    ))}
                                    {item.tags.length > 3 && (
                                        <span className="text-[10px] text-muted-foreground self-center">+{item.tags.length - 3}</span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
    )
}
