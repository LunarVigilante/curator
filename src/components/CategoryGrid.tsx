'use client'

import { useState, useTransition, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { Pencil, Grid2X2, GripVertical } from 'lucide-react'
import EditCategoryDialog from '@/components/dialogs/EditCategoryDialog'
import CategoryPlaceholder from '@/components/CategoryPlaceholder'
import { Badge } from '@/components/ui/badge'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core'
import { reorderCategories } from '@/lib/actions/categories'

type Category = {
    id: string
    name: string
    description: string | null
    image: string | null
    color: string | null
    metadata: string | null
    createdAt: Date | null
    isPublic: boolean
}

export default function CategoryGrid({ categories, bentoLayout = false, onSuccess }: { categories: Category[], bentoLayout?: boolean, onSuccess?: () => void }) {
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [, startTransition] = useTransition()
    const [localCategories, setLocalCategories] = useState(categories)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        setLocalCategories(categories)
    }, [categories])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (!over || active.id === over.id) {
            setActiveId(null)
            return
        }

        const oldIndex = localCategories.findIndex(cat => cat.id === active.id)
        const newIndex = localCategories.findIndex(cat => cat.id === over.id)

        // Reorder locally
        const reordered = [...localCategories]
        const [moved] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, moved)

        setLocalCategories(reordered)

        // Calculate new order for ALL items
        const updates = reordered.map((cat, index) => ({
            id: cat.id,
            sortOrder: index
        }))

        // Update order in database
        startTransition(async () => {
            await reorderCategories(updates)
            onSuccess?.()
        })

        setActiveId(null)
    }

    const activeCategory = localCategories.find(cat => cat.id === activeId)

    // Get grid classes based on card position for bento layout
    const getGridClasses = (index: number) => {
        if (!bentoLayout) return ''
        if (index === 0) return 'md:col-span-2 md:row-span-2' // Anime: 2×2 big square
        if (index === 1 || index === 2) return 'md:col-span-2' // Manga & Games: 2×1 wide rectangles
        return '' // Others: 1×1 regular squares
    }

    // Get aspect ratio based on card position
    const getAspectClass = (index: number) => {
        if (!bentoLayout) return 'aspect-video'
        if (index === 0) return 'aspect-square'
        return 'aspect-[4/3]'
    }

    if (!mounted) return null

    return (
        <DndContext
            id="category-grid-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className={bentoLayout
                ? "grid grid-cols-1 md:grid-cols-4 gap-4 w-full auto-rows-[200px]"
                : "flex flex-wrap justify-center gap-6 w-full"
            }>
                {localCategories.map((category, index) => (
                    <DraggableCategory
                        key={category.id}
                        category={category}
                        index={index}
                        bentoLayout={bentoLayout}
                        getGridClasses={getGridClasses}
                        onEdit={setEditingCategory}
                    />
                ))}
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
                {activeCategory ? (
                    <div className="w-[200px] aspect-video opacity-80">
                        <Card className="h-full overflow-hidden border-0 py-0 gap-0 rounded-lg bg-transparent">
                            <CardContent className="p-0 relative h-full overflow-hidden">
                                {activeCategory.image ? (
                                    <Image
                                        src={activeCategory.image}
                                        alt={activeCategory.name}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <CategoryPlaceholder name={activeCategory.name} color={activeCategory.color} emoji={(activeCategory as any).emoji} className="absolute inset-0" />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : null}
            </DragOverlay>

            {editingCategory && (
                <EditCategoryDialog
                    category={editingCategory}
                    open={!!editingCategory}
                    onOpenChange={(open) => !open && setEditingCategory(null)}
                    onSuccess={onSuccess || (() => { })}
                />
            )}
        </DndContext>
    )
}

function DraggableCategory({ category, index, bentoLayout, getGridClasses, onEdit }: {
    category: Category
    index: number
    bentoLayout: boolean
    getGridClasses: (index: number) => string
    onEdit: (category: Category) => void
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: category.id,
    })

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: category.id,
    })

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined

    return (
        <div
            ref={(node) => {
                setNodeRef(node)
                setDroppableRef(node)
            }}
            style={{
                ...style,
                ...(bentoLayout ? undefined : { maxWidth: '300px', minWidth: '200px', flex: '1 1 300px' })
            }}
            className={`relative group ${getGridClasses(index)} ${isDragging ? 'opacity-50' : ''} ${isOver ? 'ring-2 ring-blue-500' : ''}`}
        >
            <div className="h-full">
                <Link href={`/categories/${category.id}`} className="block h-full">
                    <Card className="h-full overflow-hidden border-0 py-0 gap-0 rounded-lg bg-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                        <CardContent className="p-0 relative h-full overflow-hidden">
                            {category.image ? (
                                <Image
                                    src={category.image}
                                    alt={category.name}
                                    fill
                                    className="object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
                                />
                            ) : (
                                <CategoryPlaceholder name={category.name} color={category.color} emoji={(category as any).emoji} className="absolute inset-0" />
                            )}
                            <div className="absolute top-3 left-3 z-10">
                                {category.isPublic && (
                                    <Badge variant="secondary" className="bg-black/50 hover:bg-black/70 text-white border-0 backdrop-blur-sm">
                                        Public
                                    </Badge>
                                )}
                            </div>
                            {/* Dark gradient overlay - always visible */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                                <h3 className={`font-bold text-white mb-1 ${bentoLayout && index === 0 ? 'text-3xl md:text-4xl' : 'text-xl'}`}>
                                    {category.name}
                                </h3>
                                <p className={`text-white/80 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${bentoLayout && index === 0 ? 'text-base' : 'text-sm'}`}>
                                    {category.description || 'No description available'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Edit Button */}
            <Button
                size="icon"
                variant="secondary"
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onEdit(category)
                }}
            >
                <Pencil className="h-4 w-4" />
            </Button>

            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-3 right-14 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-grab active:cursor-grabbing p-2 rounded-md hover:bg-black/20 text-white/80 hover:text-white"
            >
                <GripVertical className="h-5 w-5 drop-shadow-md" />
            </div>
        </div>
    )
}
