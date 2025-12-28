'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    closestCenter,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    useDraggable,
    useDroppable,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useTransition, useEffect, useRef, useOptimistic } from 'react'
import { assignItemToTier, removeItemTier } from '@/lib/actions/tiers'
import { createCustomRank, deleteCustomRank, updateCustomRank, updateCustomRankOrder } from '@/lib/actions/customRanks'
import {
    Pencil, Plus, GripVertical, Trash2, Check, X, Eye, Image as ImageIcon,
    ArrowDownAZ, ArrowUpAZ, Calendar, ChevronDown, Trophy, BarChart3, Share, Loader2, Save, AlertCircle
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toPng } from 'html-to-image';
import { LegacyShareCard } from '@/components/sharing/LegacyShareCard';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from '@/components/ui/slider'
import EditItemDialog from '@/components/dialogs/EditItemDialog'
import AddItemDialog from '@/components/dialogs/AddItemDialog'
import { CreateTierDialog } from '@/components/dialogs/CreateTierDialog'
import { TournamentModal } from '@/components/dialogs/TournamentModal'
import StatsDashboard from '@/components/stats/StatsDashboard'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import ItemPlaceholder from '@/components/ItemPlaceholder'
import TagSelector from '@/components/tags/TagSelector'
import { toast } from 'sonner'

export type Item = {
    id: string
    name: string
    description: string | null
    image: string | null
    categoryId: string | null
    metadata: string | null
    tier: string | null  // Direct tier from items table
    ratings: { tier: string | null, value: number }[]
    tags: { id: string; name: string }[]
    eloScore: number
    numericalRating?: number
    createdAt?: Date
}

type CustomRank = {
    id: string
    name: string
    sentiment: 'positive' | 'neutral' | 'negative'
    color: string | null
    sortOrder: number
}

const DEFAULT_TIERS = [
    { name: 'S', color: '#f87171' }, // red-400
    { name: 'A', color: '#fb923c' }, // orange-400
    { name: 'B', color: '#facc15' }, // yellow-400
    { name: 'C', color: '#4ade80' }, // green-400
    { name: 'D', color: '#60a5fa' }, // blue-400
    { name: 'F', color: '#a855f7' }, // purple-500
]

export default function TierListBoard({
    items,
    categoryId,
    categoryMetadata,
    customRanks: initialCustomRanks,
    isEditMode = false,
    showUnranked = true,
    tileSize = 120,
    hoveredItemId,
    onHoverChange,
    flashItem,
    editingItemId,
    onEditingItemIdChange,
    userName = 'User', // Default
    userImage,
    categoryName = 'My Ranking' // Pass this down or parse from metadata
}: {
    items: Item[]
    categoryId: string
    categoryMetadata: string | null
    customRanks: CustomRank[]
    isEditMode?: boolean
    showUnranked?: boolean
    tileSize?: number
    hoveredItemId?: string | null
    onHoverChange?: (id: string | null) => void
    flashItem?: { id: string, type: 'move' | 'delete' | 'edit' | 'unranked' } | null
    editingItemId?: string | null
    onEditingItemIdChange?: (id: string | null) => void
    userName?: string
    userImage?: string | null
    categoryName?: string
}) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [dragType, setDragType] = useState<'item' | 'row' | null>(null)
    const [ranks, setRanks] = useState<CustomRank[]>(initialCustomRanks)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [isTournamentOpen, setIsTournamentOpen] = useState(false)
    const [showStats, setShowStats] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [, startTransition] = useTransition()

    // Optimistic UI for items
    const [optimisticItems, updateOptimisticItem] = useOptimistic(
        items,
        (state: Item[], { id, tier }: { id: string, tier: string | null }) => {
            return state.map(item => item.id === id ? { ...item, tier } : item)
        }
    )

    // Share Feature
    const [isSharing, setIsSharing] = useState(false);
    const shareRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true)
    }, [])


    useEffect(() => {
        setRanks(initialCustomRanks)
    }, [initialCustomRanks])

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor)
    )

    const getItemTier = (item: Item) => {
        // Read tier directly from items table field (set by assignItemToTier)
        return item.tier || 'Unranked'
    }

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        setActiveId(active.id as string)
        setDragType(active.data.current?.type || 'item')
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (!over) {
            setActiveId(null)
            setDragType(null)
            return
        }

        if (dragType === 'row') {
            if (active.id !== over.id) {
                const oldIndex = ranks.findIndex((r) => r.id === active.id)
                const newIndex = ranks.findIndex((r) => r.id === over.id)
                const newRanks = arrayMove(ranks, oldIndex, newIndex)
                setRanks(newRanks)

                startTransition(async () => {
                    const rankOrders = newRanks.map((r, i) => ({ id: r.id, sortOrder: i }))
                    await updateCustomRankOrder(categoryId, rankOrders)
                })
            }
        } else {
            const itemId = active.id as string
            let targetTier = over.id as string

            const matchedRank = ranks.find(r => r.id === targetTier)
            if (matchedRank) {
                targetTier = matchedRank.name
            }

            // OPTIMISTIC UPDATE: Update local state immediately via useOptimistic
            startTransition(async () => {
                updateOptimisticItem({ id: itemId, tier: targetTier === 'Unranked' ? null : targetTier })

                try {
                    if (targetTier === 'Unranked') {
                        await removeItemTier(itemId, categoryId)
                    } else {
                        await assignItemToTier(itemId, targetTier, categoryId)
                    }
                    toast.success(`Moved to ${targetTier}`)
                } catch (error) {
                    console.error('Failed to update tier:', error)
                    toast.error('Failed to update tier')
                }
            })
        }

        setActiveId(null)
        setDragType(null)
    }

    const handleAddRow = () => {
        setIsCreateDialogOpen(true)
    }

    const handleShare = async () => {
        if (!shareRef.current) return;

        setIsSharing(true);
        try {
            const dataUrl = await toPng(shareRef.current, { cacheBust: true, pixelRatio: 1 });

            const link = document.createElement('a');
            link.download = `${categoryName.replace(/\s+/g, '-').toLowerCase()}-ranking.png`;
            link.href = dataUrl;
            link.click();
            toast.success("Image generated!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate image.");
        } finally {
            setIsSharing(false);
        }
    };

    const getSortedShareItems = () => {
        const sortedItems: any[] = [];
        // Use custom ranks or default tiers logic
        const currentRanks = ranks.length > 0 ? ranks : DEFAULT_TIERS.map((t, i) => ({
            id: t.name, name: t.name, color: t.color, sortOrder: i, sentiment: 'neutral' as const
        }));

        currentRanks.forEach(rank => {
            const tierItems = optimisticItems.filter(i => (item => {
                const rating = item.ratings.find(r => r.tier)
                return (rating?.tier || 'Unranked') === rank.name
            })(i));
            // Sort by rank field if exists, otherwise assume order of array is rough approximation or arbitrary
            tierItems.sort((a, b) => (a.eloScore || 0) - (b.eloScore || 0)); // No explicit rank field visible in `Item` type in my previous view, using elo or index?
            // Actually `items` has `rank` in the schema but `Item` type in this file:
            // ratings: { tier: string | null, value: number }[]
            // It doesn't show `rank` in the Item type definition on line 53.
            // But schema says `rank: integer('rank')`.
            // Let's check `Item` type again.
            // Lines 53-64: No `rank` property.
            // I'll just skip sorting by rank for now or use ELO.
            sortedItems.push(...tierItems);
        });

        return sortedItems;
    };

    const shareItems = getSortedShareItems();

    const activeItem = optimisticItems.find(item => item.id === activeId)
    const activeRow = ranks.find(r => r.id === activeId)

    // Visual fallback if no custom ranks exist
    const displayRanks = ranks.length > 0 ? ranks : DEFAULT_TIERS.map((t, i) => ({
        id: t.name,
        name: t.name,
        color: t.color,
        sortOrder: i,
        sentiment: 'neutral' as const
    }))

    if (optimisticItems.length === 0 && !isEditMode) {
        return (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-lg bg-zinc-900/50">
                <div className="text-center space-y-4">
                    <h3 className="text-xl font-semibold text-white">No items yet</h3>
                    <p className="text-muted-foreground max-w-sm">
                        This category is empty. Add your first item to start ranking!
                    </p>
                    <AddItemDialog categoryId={categoryId} categoryName={categoryName} categoryMetadata={categoryMetadata} trigger={
                        <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white border-none shadow-lg transition-all hover:scale-105">
                            <Plus className="mr-2 h-4 w-4" />
                            Add First Item
                        </Button>
                    } />
                </div>
            </div>
        )
    }

    if (!mounted) {
        return <div className="space-y-4 min-h-[400px]" />
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-4">
                {/* Hidden Share Card Container */}
                <div className="fixed left-[-9999px] top-0 pointer-events-none">
                    <LegacyShareCard
                        ref={shareRef}
                        userName={userName || 'User'}
                        userImage={userImage}
                        listTitle={categoryName}
                        items={shareItems}
                    />
                </div>

                {/* Toolbox Header */}
                <div className="flex justify-between items-center bg-black/40 backdrop-blur-md p-2 rounded-xl mb-4 border border-white/5">
                    <div className="px-2 text-sm font-medium text-zinc-400">
                        Drag & Drop Ranking
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleShare}
                            disabled={isSharing}
                            className="gap-2 text-zinc-400 hover:text-white hover:bg-white/10"
                        >
                            {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share className="w-4 h-4" />}
                            Share Image
                        </Button>
                    </div>
                </div>

                <div className="border border-white/5 rounded-xl overflow-hidden bg-black/40 backdrop-blur-md shadow-2xl">
                    <SortableContext items={displayRanks.map(r => r.id)} strategy={verticalListSortingStrategy}>
                        {displayRanks.map((rank) => (
                            <TierRow
                                key={rank.id}
                                rank={rank}
                                isEditMode={isEditMode}
                                items={optimisticItems.filter(item => getItemTier(item) === rank.name)}
                                categoryId={categoryId}
                                tileSize={tileSize}
                                hoveredItemId={hoveredItemId}
                                onHoverChange={onHoverChange}
                                flashItem={flashItem}
                                editingItemId={editingItemId}
                                onEditingItemIdChange={onEditingItemIdChange}
                            />
                        ))}
                    </SortableContext>
                </div>

                {isEditMode && (
                    <Button
                        variant="ghost"
                        className="w-full py-10 border-2 border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 rounded-xl transition-all gap-2 text-muted-foreground hover:text-white group"
                        onClick={handleAddRow}
                    >
                        <Plus className="h-5 w-5 transition-transform group-hover:scale-110" />
                        <span className="font-semibold uppercase tracking-wider text-xs">Add New Rank</span>
                    </Button>
                )}

                {/* Tournament Mode Entry & Stats Toggle */}
                <div className="flex justify-end mb-4 gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => setShowStats(!showStats)}
                        className={`text-zinc-400 hover:text-white ${showStats ? 'bg-zinc-800 text-white' : ''}`}
                    >
                        <BarChart3 className="h-5 w-5" />
                    </Button>
                    <Button
                        onClick={() => setIsTournamentOpen(true)}
                        className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white border-0 shadow-lg gap-2"
                    >
                        <Trophy className="h-4 w-4" />
                        Start Face-Off Tournament
                    </Button>
                </div>

                {/* Stats Dashboard Overlay */}
                {showStats && (
                    <StatsDashboard itemCount={optimisticItems.length} onClose={() => setShowStats(false)} />
                )}

                {/* Unranked Pool */}
                {showUnranked && (
                    <UnrankedPool
                        items={optimisticItems.filter(item => getItemTier(item) === 'Unranked')}
                        categoryId={categoryId}
                        categoryName={categoryMetadata ? JSON.parse(categoryMetadata).name : 'Category'}
                        tileSize={tileSize}
                        hoveredItemId={hoveredItemId}
                        onHoverChange={onHoverChange}
                        flashItem={flashItem}
                        editingItemId={editingItemId}
                        onEditingItemIdChange={onEditingItemIdChange}
                    />
                )}

                <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                            active: {
                                opacity: '0.4',
                            },
                        },
                    }),
                }}>
                    {activeId ? (
                        dragType === 'row' && activeRow ? (
                            <div className="flex min-h-[100px] border border-primary/50 bg-[#18181b] shadow-2xl rounded-lg overflow-hidden opacity-90">
                                <div className="w-32 shrink-0 flex items-center justify-center" style={{ backgroundColor: activeRow.color || '#6b7280' }}>
                                    <span className="text-xl font-bold text-black text-center px-2">{activeRow.name}</span>
                                </div>
                                <div className="flex-1 p-2 bg-zinc-900" />
                            </div>
                        ) : activeItem ? (
                            <div className="relative opacity-80" style={{ width: tileSize }}>
                                <div className="relative w-full aspect-[2/3]">
                                    {activeItem.image ? (
                                        <Image
                                            src={activeItem.image}
                                            alt={activeItem.name}
                                            fill
                                            className="object-cover rounded-sm border-2 border-white"
                                        />
                                    ) : (
                                        <ItemPlaceholder name={activeItem.name} className="w-full h-full rounded-sm border-2 border-white" />
                                    )}
                                </div>
                            </div>
                        ) : null
                    ) : null}
                </DragOverlay>

                <CreateTierDialog
                    categoryId={categoryId}
                    isOpen={isCreateDialogOpen}
                    onOpenChange={setIsCreateDialogOpen}
                    onCreated={(newRank) => setRanks([...ranks, newRank])}
                />

                <TournamentModal
                    isOpen={isTournamentOpen}
                    onOpenChange={setIsTournamentOpen}
                    items={items}
                    categoryId={categoryId}
                />
            </div>
        </DndContext>
    )
}

function TierRow({
    rank,
    items,
    categoryId,
    isEditMode,
    tileSize,
    hoveredItemId,
    onHoverChange,
    flashItem,
    editingItemId,
    onEditingItemIdChange
}: {
    rank: CustomRank | { id: string, name: string, color: string | null },
    items: Item[],
    categoryId: string,
    isEditMode: boolean,
    tileSize: number
    hoveredItemId?: string | null
    onHoverChange?: (id: string | null) => void
    flashItem?: { id: string, type: 'move' | 'delete' | 'edit' | 'unranked' } | null
    editingItemId?: string | null
    onEditingItemIdChange?: (id: string | null) => void
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState(rank.name)
    const [color, setColor] = useState(rank.color || '#6b7280')
    const [, startTransition] = useTransition()

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: rank.id,
        data: { type: 'row' },
        disabled: !isEditMode
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    }

    const handleSave = () => {
        startTransition(async () => {
            try {
                await updateCustomRank(rank.id as string, { name, color })
                setIsEditing(false)
                toast.success('Updated tier')
            } catch (error) {
                toast.error('Failed to update tier')
            }
        })
    }

    const handleDelete = () => {
        if (confirm(`Delete tier "${rank.name}"?`)) {
            startTransition(async () => {
                try {
                    await deleteCustomRank(rank.id as string)
                    toast.success('Deleted tier')
                } catch (error) {
                    toast.error('Failed to delete tier')
                }
            })
        }
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex min-h-[100px] border-b border-white/5 last:border-0 ${isDragging ? 'opacity-30' : ''}`}
        >
            {/* Rank Label Container */}
            <div className="flex shrink-0">
                {isEditMode && (
                    <div {...listeners} className="w-8 flex items-center justify-center bg-zinc-900 border-r border-zinc-800 cursor-grab hover:bg-zinc-800 transition-colors">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                )}

                <div
                    className="w-32 flex items-center justify-center shrink-0 transition-colors relative group"
                    style={{ backgroundColor: isEditing ? color : (rank.color || '#6b7280') }}
                >
                    {isEditMode ? (
                        isEditing ? (
                            <div className="absolute inset-x-0 inset-y-0 p-1 flex flex-col items-center justify-center gap-1 bg-zinc-900/90 backdrop-blur-sm z-20">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-[90%] text-xs bg-zinc-800 border border-zinc-700 rounded p-1 text-white focus:ring-1 focus:ring-primary text-center font-bold"
                                    autoFocus
                                />
                                <div className="flex gap-1 justify-center">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="h-5 w-5 rounded-full cursor-pointer bg-transparent border-none p-0 overflow-hidden"
                                    />
                                    <Button size="icon" variant="ghost" className="h-5 w-5 text-green-500 hover:bg-green-500/10" onClick={handleSave}>
                                        <Check className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-5 w-5 text-red-500 hover:bg-red-500/10" onClick={() => setIsEditing(false)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1 w-full px-2">
                                <span className={`font-bold text-black text-center leading-tight break-words max-w-full ${rank.name.length > 5 ? 'text-sm' : 'text-xl'}`}>
                                    {rank.name}
                                </span>
                                <div className="hidden group-hover:flex gap-1 absolute bottom-1">
                                    <Button size="icon" variant="secondary" className="h-5 w-5 bg-white/20 hover:bg-white/40 border-none shadow-sm" onClick={() => setIsEditing(true)}>
                                        <Pencil className="h-2.5 w-2.5 text-black" />
                                    </Button>
                                    {items.length === 0 && (
                                        <Button size="icon" variant="destructive" className="h-5 w-5 bg-red-500/80 hover:bg-red-500 border-none shadow-sm" onClick={handleDelete}>
                                            <Trash2 className="h-2.5 w-2.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    ) : (
                        <span className={`font-bold text-black text-center leading-tight px-2 break-words max-w-full ${rank.name.length > 5 ? 'text-sm' : 'text-2xl'}`}>
                            {rank.name}
                        </span>
                    )}
                </div>
            </div>

            {/* Droppable Tier Content */}
            <DroppableZone id={rank.name}>
                <div className="flex-1 p-3 flex flex-wrap gap-3 bg-transparent/5 min-h-[100px]">
                    {items.map(item => (
                        <DraggableItem
                            key={item.id}
                            item={item}
                            categoryId={categoryId}
                            tileSize={tileSize}
                            hoveredItemId={hoveredItemId}
                            onHoverChange={onHoverChange}
                            flashItem={flashItem}
                            editingItemId={editingItemId}
                            onEditingItemIdChange={onEditingItemIdChange}
                        />
                    ))}
                </div>
            </DroppableZone>
        </div>
    )
}

function UnrankedPool({
    items,
    categoryId,
    categoryName,
    tileSize,
    hoveredItemId,
    onHoverChange,
    flashItem,
    editingItemId,
    onEditingItemIdChange
}: {
    items: Item[],
    categoryId: string,
    categoryName: string,
    tileSize: number,
    hoveredItemId?: string | null
    onHoverChange?: (id: string | null) => void
    flashItem?: { id: string, type: 'move' | 'delete' | 'edit' | 'unranked' } | null
    editingItemId?: string | null
    onEditingItemIdChange?: (id: string | null) => void
}) {
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest')

    const sortedItems = [...items].sort((a, b) => {
        if (sortOrder === 'newest') {
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        }
        if (sortOrder === 'oldest') {
            return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        }
        if (sortOrder === 'az') {
            return a.name.localeCompare(b.name)
        }
        if (sortOrder === 'za') {
            return b.name.localeCompare(a.name)
        }
        return 0
    })

    return (
        <Card className="p-6 bg-black/40 backdrop-blur-md border-white/5 shadow-xl rounded-xl export-exclude">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                    Unranked Items
                    <span className="text-sm font-normal text-muted-foreground bg-zinc-800/50 px-2 py-0.5 rounded-full">
                        {items.length}
                    </span>
                </h3>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-white px-2">
                                {sortOrder === 'newest' && <Calendar className="h-3.5 w-3.5" />}
                                {sortOrder === 'oldest' && <Calendar className="h-3.5 w-3.5 rotate-180" />}
                                {sortOrder === 'az' && <ArrowDownAZ className="h-3.5 w-3.5" />}
                                {sortOrder === 'za' && <ArrowUpAZ className="h-3.5 w-3.5" />}
                                <span className="text-xs">
                                    {sortOrder === 'newest' && 'Newest'}
                                    {sortOrder === 'oldest' && 'Oldest'}
                                    {sortOrder === 'az' && 'A-Z'}
                                    {sortOrder === 'za' && 'Z-A'}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSortOrder('newest')}>
                                <Calendar className="mr-2 h-4 w-4" /> Newest First
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortOrder('oldest')}>
                                <Calendar className="mr-2 h-4 w-4 rotate-180" /> Oldest First
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortOrder('az')}>
                                <ArrowDownAZ className="mr-2 h-4 w-4" /> Name (A-Z)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortOrder('za')}>
                                <ArrowUpAZ className="mr-2 h-4 w-4" /> Name (Z-A)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <AddItemDialog
                        categoryId={categoryId}
                        categoryName={categoryName}
                        trigger={
                            <Button variant="ghost" size="sm" className="h-8 border-dashed border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50 gap-1.5 text-muted-foreground hover:text-white px-3">
                                <Plus className="h-3.5 w-3.5" />
                                Quick Add
                            </Button>
                        }
                    />
                </div>
            </div>

            <DroppableZone id="Unranked">
                <div className="flex flex-wrap gap-4 min-h-[120px] p-1">
                    {sortedItems.map(item => (
                        <DraggableItem
                            key={item.id}
                            item={item}
                            categoryId={categoryId}
                            tileSize={tileSize}
                            hoveredItemId={hoveredItemId}
                            onHoverChange={onHoverChange}
                            flashItem={flashItem}
                            editingItemId={editingItemId}
                            onEditingItemIdChange={onEditingItemIdChange}
                        />
                    ))}
                    {items.length === 0 && (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-zinc-800/50 rounded-lg text-muted-foreground text-sm py-8">
                            Drag items here to unrank them
                        </div>
                    )}
                </div>
            </DroppableZone>
        </Card>
    )
}

function DraggableItem({
    item,
    categoryId,
    tileSize,
    hoveredItemId,
    onHoverChange,
    flashItem,
    editingItemId,
    onEditingItemIdChange
}: {
    item: Item,
    categoryId: string,
    tileSize: number,
    hoveredItemId?: string | null
    onHoverChange?: (id: string | null) => void
    flashItem?: { id: string, type: 'move' | 'delete' | 'edit' | 'unranked' } | null
    editingItemId?: string | null
    onEditingItemIdChange?: (id: string | null) => void
}) {
    const [isEditing, setIsEditing] = useState(false)
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: item.id,
        data: { type: 'item' }
    })

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined

    useEffect(() => {
        if (editingItemId === item.id) {
            if (!isEditing) {
                setIsEditing(true)
            }
            // Clear the parent's editing state after taking over locally to avoid loops
            if (onEditingItemIdChange) {
                // Defer the callback to avoid update-during-render
                setTimeout(() => onEditingItemIdChange(null), 0)
            }
        }
    }, [editingItemId, item.id, onEditingItemIdChange, isEditing])

    const isHovered = hoveredItemId === item.id
    const isFlashing = flashItem?.id === item.id
    const [showRemoveDialog, setShowRemoveDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const flashClasses = {
        move: 'ring-4 ring-white animate-pulse',
        delete: 'ring-4 ring-red-500 animate-pulse',
        edit: 'ring-4 ring-blue-500 animate-pulse',
        unranked: 'ring-4 ring-zinc-400 animate-pulse'
    }

    const handleRemoveClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setShowRemoveDialog(true)
    }

    const confirmRemove = async () => {
        setIsDeleting(true)
        setShowRemoveDialog(false)
        const { deleteItem } = await import('@/lib/actions/items')
        await deleteItem(item.id, categoryId)
    }

    const handleCardClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsEditing(true)
    }

    return (
        <>
            <div
                ref={setNodeRef}
                style={{ ...style, width: tileSize }}
                {...attributes}
                tabIndex={0}
                role="button"
                aria-label={`${item.name}. Press Enter to edit, or drag to move to a different tier.`}
                onMouseEnter={() => onHoverChange?.(item.id)}
                onMouseLeave={() => onHoverChange?.(null)}
                className={`relative group cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isDragging ? 'opacity-30 scale-95' : 'hover:scale-105'} transition-all duration-200 z-0 hover:z-10 ${isFlashing ? flashClasses[flashItem!.type] : ''} ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
            >
                {/* Card image - click to edit */}
                <div
                    {...listeners}
                    onClick={handleCardClick}
                    className="relative w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-zinc-900 shadow-md cursor-pointer"
                >
                    {item.image ? (
                        <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <ItemPlaceholder name={item.name} className="w-full h-full" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-[10px] font-medium text-white line-clamp-2 leading-tight">{item.name}</span>
                    </div>
                </div>

                {/* Action buttons - edit and remove */}
                <div className="absolute -top-1.5 -right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all z-20">
                    <Button
                        size="icon"
                        variant="secondary"
                        className="h-6 w-6 shadow-lg rounded-full"
                        aria-label={`Edit ${item.name}`}
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsEditing(true)
                        }}
                    >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                    </Button>
                    <Button
                        size="icon"
                        variant="destructive"
                        className="h-6 w-6 shadow-lg rounded-full bg-red-500/90 hover:bg-red-600"
                        aria-label={`Remove ${item.name}`}
                        onClick={handleRemoveClick}
                    >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </Button>
                </div>
            </div>

            {isEditing && (
                <EditItemDialog
                    item={item}
                    open={isEditing}
                    onOpenChange={setIsEditing}
                    categoryId={categoryId}
                />
            )}

            {/* Styled Remove Confirmation Dialog */}
            <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">Remove Item</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Remove <span className="font-semibold text-zinc-200">"{item.name}"</span> from this category?
                            <br />
                            <span className="text-xs text-zinc-500 mt-2 block">This will only remove it from this category, not from other collections.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRemove}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
            className={`flex-1 ${isOver ? 'bg-zinc-800/40 ring-2 ring-primary/20' : ''} transition-all rounded-r-xl`}
        >
            {children}
        </div>
    )
}
