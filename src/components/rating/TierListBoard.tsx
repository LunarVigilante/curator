'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core'
import { useState, useTransition } from 'react'
import { assignItemToTier, removeItemTier } from '@/lib/actions/tiers'
import { Pencil } from 'lucide-react'
import EditItemDialog from '@/components/dialogs/EditItemDialog'
import ItemPlaceholder from '@/components/ItemPlaceholder'
import TagSelector from '@/components/tags/TagSelector'

type Item = {
    id: string
    name: string
    description: string | null
    image: string | null
    categoryId: string | null
    metadata: string | null
    ratings: { tier: string | null, value: number }[]
    tags: { id: string; name: string }[]
}

const TIERS = [
    { name: 'S', color: 'bg-red-400' },
    { name: 'A', color: 'bg-orange-400' },
    { name: 'B', color: 'bg-yellow-400' },
    { name: 'C', color: 'bg-green-400' },
    { name: 'D', color: 'bg-blue-400' },
    { name: 'F', color: 'bg-purple-400' },
]

export default function TierListBoard({
    items,
    categoryId,
    categoryMetadata
}: {
    items: Item[]
    categoryId: string
    categoryMetadata: string | null
}) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [, startTransition] = useTransition()

    const filteredItems = items.filter(item => {
        if (selectedTags.length === 0) return true
        return selectedTags.every(tagId => item.tags.some(t => t.id === tagId))
    })

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    // Helper to find item's tier
    const getItemTier = (item: Item) => {
        const rating = item.ratings.find(r => r.tier)
        return rating?.tier || 'Unranked'
    }

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (!over) {
            setActiveId(null)
            return
        }

        const itemId = active.id as string
        const targetTier = over.id as string

        // Update tier assignment
        startTransition(async () => {
            if (targetTier === 'Unranked') {
                await removeItemTier(itemId, categoryId)
            } else {
                await assignItemToTier(itemId, targetTier, categoryId)
            }
        })

        setActiveId(null)
    }

    const activeItem = items.find(item => item.id === activeId)

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-4">
                <div className="flex justify-end">
                    <div className="w-72">
                        <TagSelector
                            selectedTags={selectedTags}
                            onTagsChange={setSelectedTags}
                        />
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden bg-zinc-900">
                    {TIERS.map((tier) => (
                        <TierRow
                            key={tier.name}
                            tier={tier}
                            items={filteredItems.filter(item => getItemTier(item) === tier.name)}
                            categoryId={categoryId}
                        />
                    ))}
                </div>

                {/* Unranked Pool */}
                <UnrankedPool
                    items={filteredItems.filter(item => getItemTier(item) === 'Unranked')}
                    categoryId={categoryId}
                />

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeItem ? (
                        <div className="relative w-20 h-20 opacity-80">
                            {activeItem.image ? (
                                <Image
                                    src={activeItem.image}
                                    alt={activeItem.name}
                                    fill
                                    className="object-cover rounded-sm border-2 border-white"
                                />
                            ) : (
                                <ItemPlaceholder name={activeItem.name} size={80} className="border-2 border-white" />
                            )}
                        </div>
                    ) : null}
                </DragOverlay>
            </div>
        </DndContext>
    )
}

function TierRow({ tier, items, categoryId }: { tier: { name: string, color: string }, items: Item[], categoryId: string }) {
    return (
        <div
            id={tier.name}
            data-tier={tier.name}
            className="flex min-h-[100px] border-b border-zinc-800 last:border-0"
        >
            {/* Tier Label */}
            <div className={`${tier.color} w-24 flex items-center justify-center shrink-0`}>
                <span className="text-2xl font-bold text-black">{tier.name}</span>
            </div>

            {/* Droppable Tier Content */}
            <DroppableZone id={tier.name}>
                <div className="flex-1 p-2 flex flex-wrap gap-2 bg-zinc-900 min-h-[100px]">
                    {items.map(item => (
                        <DraggableItem key={item.id} item={item} categoryId={categoryId} />
                    ))}
                </div>
            </DroppableZone>
        </div>
    )
}

function UnrankedPool({ items, categoryId }: { items: Item[], categoryId: string }) {
    return (
        <Card className="p-4 bg-zinc-900 border-zinc-800">
            <h3 className="text-lg font-semibold mb-4 text-white">Unranked Items</h3>
            <DroppableZone id="Unranked">
                <div className="flex flex-wrap gap-2 min-h-[100px]">
                    {items.map(item => (
                        <DraggableItem key={item.id} item={item} categoryId={categoryId} />
                    ))}
                </div>
            </DroppableZone>
        </Card>
    )
}

function DraggableItem({ item, categoryId }: { item: Item, categoryId: string }) {
    const [isEditing, setIsEditing] = useState(false)
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: item.id,
    })

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                className={`relative w-20 h-20 group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''
                    }`}
            >
                {/* Drag handle only - exclude edit button */}
                <div {...listeners} className="absolute inset-0">
                    {item.image ? (
                        <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover rounded-sm"
                        />
                    ) : (
                        <ItemPlaceholder name={item.name} size={80} />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs text-white text-center p-1">{item.name}</span>
                    </div>
                </div>

                {/* Edit button */}
                <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsEditing(true)
                    }}
                >
                    <Pencil className="h-3 w-3" />
                </Button>
            </div>

            {isEditing && (
                <EditItemDialog
                    item={item}
                    open={isEditing}
                    onOpenChange={setIsEditing}
                    categoryId={categoryId}
                />
            )}
        </>
    )
}

function DroppableZone({ id, children }: { id: string, children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
        id,
    })

    return (
        <div
            ref={setNodeRef}
            className={`flex-1 ${isOver ? 'bg-zinc-800' : ''} transition-colors`}
        >
            {children}
        </div>
    )
}
