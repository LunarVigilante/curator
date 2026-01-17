'use client'

import { forwardRef, memo } from 'react'
import ItemCard, { Item } from './ItemCard'

interface ItemGridProps {
    items: Item[]
    cardMinWidth?: number // in pixels, default 200
}

const ItemGrid = memo(forwardRef<HTMLDivElement, ItemGridProps>(
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
                    <ItemCard
                        key={item.id}
                        item={item}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 20vw"
                    />
                ))}
            </div>
        )
    }
))

ItemGrid.displayName = 'ItemGrid'

export default ItemGrid
