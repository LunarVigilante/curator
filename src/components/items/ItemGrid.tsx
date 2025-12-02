'use client'

import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import ItemPlaceholder from '@/components/ItemPlaceholder'

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

export default function ItemGrid({ items }: { items: Item[] }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => (
                <Link key={item.id} href={`/items/${item.id}`} className="block h-full group">
                    <Card className="h-full overflow-hidden border-0 bg-muted/20 hover:bg-muted/40 transition-all duration-200 hover:-translate-y-1 hover:shadow-md relative">
                        {item.ratings[0] && (
                            <div className="absolute top-2 right-2 z-10">
                                <Badge variant={item.ratings[0].type === 'TIER' ? 'default' : 'secondary'} className="shadow-sm">
                                    {item.ratings[0].type === 'TIER' ? item.ratings[0].tier : item.ratings[0].value}
                                </Badge>
                            </div>
                        )}
                        <CardContent className="p-0 flex flex-col h-full">
                            <div className="relative aspect-square overflow-hidden">
                                {item.image ? (
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                ) : (
                                    <ItemPlaceholder name={item.name} size={200} className="w-full h-full" />
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
