'use client'

import { forwardRef } from 'react'
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

interface ItemGridProps {
    items: Item[]
    cardMinWidth?: number // in pixels, default 200
}

const ItemGrid = forwardRef<HTMLDivElement, ItemGridProps>(
    ({ items, cardMinWidth = 200 }, ref) => {
        return (
            <div
                ref={ref}
                className="grid gap-4"
                style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth}px, 1fr))`
                }}
            >
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
)

ItemGrid.displayName = 'ItemGrid'

export default ItemGrid
