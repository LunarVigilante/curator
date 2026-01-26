'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
    CheckCircle2,
    Circle,
    ChevronDown,
    ChevronUp,
    Folder,
    ListPlus,
    Swords,
    Star,
    BarChart3,
    Sparkles
} from 'lucide-react'
import { getChecklistStatus, type ChecklistStatus, type ChecklistItem } from '@/lib/actions/checklist'
import { getUserCategoriesForChecklist } from '@/lib/actions/checklist'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import CreateCategoryDialog from '@/components/dialogs/CreateCategoryDialog'
import CollectionPickerModal, { type CollectionOption } from '@/components/dialogs/CollectionPickerModal'

// Icon mapping for checklist items
const ITEM_ICONS: Record<string, React.ElementType> = {
    create_collection: Folder,
    add_items: ListPlus,
    face_off: Swords,
    rate_items: Star,
    taste_profile: BarChart3,
}

interface GettingStartedChecklistProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string
}

export default function GettingStartedChecklist({ className, ...props }: GettingStartedChecklistProps) {
    const router = useRouter()
    const [status, setStatus] = useState<ChecklistStatus | null>(null)
    const [isExpanded, setIsExpanded] = useState(true)
    const [loading, setLoading] = useState(true)
    const [collections, setCollections] = useState<CollectionOption[]>([])

    // Modal states
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [showCollectionPicker, setShowCollectionPicker] = useState(false)
    const [highlightedItem, setHighlightedItem] = useState<string | null>(null)

    useEffect(() => {
        loadChecklist()
    }, [])

    async function loadChecklist() {
        try {
            const [checklistResult, collectionsResult] = await Promise.all([
                getChecklistStatus(),
                getUserCategoriesForChecklist()
            ])
            setStatus(checklistResult)
            setCollections(collectionsResult)
            // Auto-collapse if all complete
            if (checklistResult.allComplete) {
                setIsExpanded(false)
            }
        } catch (error) {
            console.error('Failed to load checklist:', error)
        } finally {
            setLoading(false)
        }
    }

    // Handler: Add Items action
    function handleAddItems() {
        if (collections.length === 0) {
            // No collections - open create dialog
            toast.info('Create a collection first!')
            setShowCreateDialog(true)
        } else if (collections.length === 1) {
            // Single collection - navigate directly
            router.push(`/categories/${collections[0].id}?action=add_item`)
        } else {
            // Multiple collections - show picker
            setShowCollectionPicker(true)
        }
    }

    // Handler: Face-Off action
    function handleFaceOff() {
        // Find a collection with at least 3 items
        const validCollection = collections.find(c => c.itemCount >= 3)

        if (validCollection) {
            router.push(`/categories/${validCollection.id}/face-off`)
        } else {
            toast.warning('You need at least 3 items in a collection to start a tournament!')
            // Highlight the Add Items task
            setHighlightedItem('add_items')
            setTimeout(() => setHighlightedItem(null), 3000)
        }
    }

    // Handler: Collection selected from picker
    function handleCollectionSelect(collection: CollectionOption) {
        router.push(`/categories/${collection.id}?action=add_item`)
    }

    // Get dynamic button text based on context
    function getButtonText(itemId: string): string {
        switch (itemId) {
            case 'create_collection':
                return 'Create'
            case 'add_items':
                if (collections.length === 0) return 'Create Collection'
                if (collections.length === 1) return 'Go to Collection'
                return 'Choose Collection'
            case 'face_off':
                const validCollection = collections.find(c => c.itemCount >= 3)
                return validCollection ? 'Start' : 'Add More Items'
            default:
                return 'Start'
        }
    }

    // Get click handler for each item
    function getClickHandler(itemId: string): (() => void) | undefined {
        switch (itemId) {
            case 'add_items':
                return handleAddItems
            case 'face_off':
                return handleFaceOff
            default:
                return undefined
        }
    }

    // Don't show if all complete and collapsed
    if (status?.allComplete && !isExpanded) {
        return null
    }

    // Loading state
    if (loading) {
        return (
            <Card className={cn("bg-zinc-900/50 backdrop-blur-md border-white/10", className)} {...props}>
                <CardContent className="p-6">
                    <div className="animate-pulse flex items-center gap-3">
                        <div className="h-8 w-8 bg-zinc-800 rounded-full" />
                        <div className="h-4 w-48 bg-zinc-800 rounded" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!status) return null

    return (
        <>
            <Card className={cn(
                "bg-zinc-900/50 backdrop-blur-md border-white/10 overflow-hidden transition-all duration-300",
                className
            )} {...props}>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-zinc-800">
                                <Sparkles className="h-5 w-5 text-zinc-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-semibold">
                                    Getting Started
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    {status.completedCount} of {status.totalCount} complete
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="h-8 w-8 p-0"
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    <Progress
                        value={status.percentComplete}
                        className="h-2 mt-3 bg-zinc-800"
                    />
                </CardHeader>

                {isExpanded && (
                    <CardContent className="pt-2 pb-4">
                        <ul className="space-y-2">
                            {status.items.map((item) => (
                                <ChecklistItemRow
                                    key={item.id}
                                    item={item}
                                    buttonText={getButtonText(item.id)}
                                    onClick={getClickHandler(item.id)}
                                    isHighlighted={highlightedItem === item.id}
                                />
                            ))}
                        </ul>
                    </CardContent>
                )}
            </Card>

            {/* Create Category Dialog */}
            <CreateCategoryDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onSuccess={() => {
                    loadChecklist() // Refresh the list
                }}
            />

            {/* Collection Picker Modal */}
            <CollectionPickerModal
                open={showCollectionPicker}
                onOpenChange={setShowCollectionPicker}
                collections={collections}
                onSelect={handleCollectionSelect}
            />
        </>
    )
}

interface ChecklistItemRowProps {
    item: ChecklistItem
    buttonText: string
    onClick?: () => void
    isHighlighted?: boolean
}

function ChecklistItemRow({ item, buttonText, onClick, isHighlighted }: ChecklistItemRowProps) {
    const Icon = ITEM_ICONS[item.id] || Circle

    return (
        <li className={cn(
            "flex items-center gap-3 p-2 rounded-lg transition-all",
            item.completed
                ? "bg-emerald-500/10 text-muted-foreground"
                : "hover:bg-zinc-800",
            isHighlighted && "ring-2 ring-amber-500/50 bg-amber-500/10 animate-pulse"
        )}>
            {item.completed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
                <Icon className="h-5 w-5 text-zinc-400 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "font-medium text-sm",
                        item.completed && "line-through"
                    )}>
                        {item.title}
                    </span>
                    {item.progress !== undefined && item.required && !item.completed && (
                        <span className="text-xs text-muted-foreground">
                            ({item.progress}/{item.required})
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                </p>
            </div>

            {!item.completed && (
                onClick ? (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={onClick}
                    >
                        {buttonText}
                    </Button>
                ) : item.href ? (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => window.location.href = item.href!}
                    >
                        {buttonText}
                    </Button>
                ) : null
            )}
        </li>
    )
}
