'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Settings, Eye, EyeOff, Plus, Share2, ArrowLeft, Search, Image as ImageIcon, ThumbsUp, Bookmark } from 'lucide-react'
import Link from 'next/link'
import EditCategoryButton from './EditCategoryButton'
import AddItemDialog from '@/components/dialogs/AddItemDialog'
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toggleLike, toggleSave } from '@/lib/actions/interactions'
import { cn } from '@/lib/utils'

import { joinChallenge, leaveChallenge } from '@/lib/actions/challenges'
import { Trophy, Users } from 'lucide-react'

interface CategoryHeaderProps {
    category: any
    isOwner: boolean
    isAdmin?: boolean
    isEditMode: boolean
    onToggleEditMode: () => void
    onExportImage: () => void
    showUnranked: boolean
    onToggleUnranked: () => void
    tileSize: number
    onTileSizeChange: (size: number) => void
    categoryOwner?: { id: string; name: string; image: string | null } | null
    initialLiked?: boolean
    initialSaved?: boolean
    initialLikeCount?: number
    initialSaveCount?: number
    challengeStatus?: { status: string; progress: number } | null
}

export default function CategoryHeader({
    category,
    isOwner,
    isAdmin = false,
    isEditMode,
    onToggleEditMode,
    onExportImage,
    showUnranked,
    onToggleUnranked,
    tileSize,
    onTileSizeChange,
    categoryOwner,
    initialLiked = false,
    initialSaved = false,
    initialLikeCount = 0,
    initialSaveCount = 0,
    challengeStatus
}: CategoryHeaderProps) {
    // User can edit if they own the collection or are an admin
    const canEdit = isOwner || isAdmin

    // Interaction state
    const [isLiked, setIsLiked] = useState(initialLiked)
    const [isSaved, setIsSaved] = useState(initialSaved)
    const [likeCount, setLikeCount] = useState(initialLikeCount)
    const [saveCount, setSaveCount] = useState(initialSaveCount)
    const [isPending, startTransition] = useTransition()

    const handleLike = () => {
        startTransition(async () => {
            const result = await toggleLike(category.id)
            if (result.success) {
                setIsLiked(result.liked!)
                setLikeCount(prev => result.liked ? prev + 1 : prev - 1)
            }
        })
    }

    const handleSave = () => {
        startTransition(async () => {
            const result = await toggleSave(category.id)
            if (result.success) {
                setIsSaved(result.saved!)
                setSaveCount(prev => result.saved ? prev + 1 : prev - 1)
            }
        })
    }

    const handleJoinChallenge = () => {
        startTransition(async () => {
            await joinChallenge(category.id);
            toast.success("Challenge Accepted!");
        });
    }

    const handleLeaveChallenge = () => {
        if (!confirm("Are you sure you want to leave this challenge?")) return;
        startTransition(async () => {
            await leaveChallenge(category.id);
            toast.success("Left Challenge");
        });
    }

    return (
        <div className="mb-6 space-y-4">
            <Link href="/">
                <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary group">
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    Back to Categories
                </Button>
            </Link>

            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
                        {category.name}
                        {canEdit && (
                            <div className="export-ignore">
                                <EditCategoryButton category={category} />
                            </div>
                        )}
                    </h1>

                    {/* Creator & Stats Row */}
                    <div className="flex items-center gap-4 mb-3 flex-wrap">
                        {/* Creator Link */}
                        {categoryOwner && (
                            <Link
                                href={`/profile/${categoryOwner.id}`}
                                className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
                            >
                                <Avatar className="h-6 w-6 border border-white/10">
                                    <AvatarImage src={categoryOwner.image || ''} />
                                    <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400">
                                        {categoryOwner.name?.[0] || '?'}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-zinc-400 group-hover:text-white transition-colors">
                                    by {categoryOwner.name || 'Unknown'}
                                </span>
                            </Link>
                        )}

                        {/* Separator */}
                        {categoryOwner && <span className="text-zinc-600">•</span>}

                        {/* Like Button & Count */}
                        <button
                            onClick={handleLike}
                            disabled={isPending}
                            className={cn(
                                "flex items-center gap-1.5 text-sm transition-colors",
                                isLiked ? "text-blue-400" : "text-zinc-400 hover:text-blue-400"
                            )}
                        >
                            <ThumbsUp className={cn("h-4 w-4", isLiked && "fill-current")} />
                            <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
                        </button>

                        {/* Separator */}
                        <span className="text-zinc-600">•</span>

                        {/* Bookmark Button & Count */}
                        <button
                            onClick={handleSave}
                            disabled={isPending}
                            className={cn(
                                "flex items-center gap-1.5 text-sm transition-colors",
                                isSaved ? "text-amber-400" : "text-zinc-400 hover:text-amber-400"
                            )}
                        >
                            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
                            <span>{saveCount} {saveCount === 1 ? 'save' : 'saves'}</span>
                        </button>
                    </div>

                    {/* Description Row */}
                    <div className="flex flex-row items-center max-w-4xl">
                        <p className="text-muted-foreground text-lg italic">
                            {category.description || "No description provided."}
                        </p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 export-ignore shrink-0 pt-1">
                    {/* Challenge Button */}
                    {category.isChallenge && (
                        challengeStatus ? (
                            <Button
                                variant="outline"
                                className={cn(
                                    "gap-2 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400",
                                    challengeStatus.status === 'COMPLETED' && "bg-yellow-500/10 border-yellow-500 text-yellow-400"
                                )}
                                onClick={handleLeaveChallenge}
                                title="Click to leave challenge"
                            >
                                <Trophy className="h-4 w-4" />
                                {challengeStatus.status === 'COMPLETED' ? 'Challenge Completed!' : 'In Progress'}
                            </Button>
                        ) : (
                            <Button
                                className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white border-none"
                                onClick={handleJoinChallenge}
                            >
                                <Trophy className="h-4 w-4" />
                                Accept Challenge
                            </Button>
                        )
                    )}

                    <AnalyzeButton categoryId={category.id} variant="ghost" canEdit={canEdit} />

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onExportImage}
                        className="transition-all"
                        title="Share Image"
                    >
                        <Share2 className="h-4 w-4" />
                    </Button>

                    {/* Tile Zoom Feature */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" title="Adjust Tile Size">
                                <Search className="h-5 w-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                            <div className="space-y-4">
                                <h4 className="font-medium leading-none">Tile Size adjustment</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Current Size</span>
                                        <span>{tileSize}px</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                                        <Slider
                                            value={[tileSize]}
                                            min={80}
                                            max={200}
                                            step={10}
                                            onValueChange={([val]) => onTileSizeChange(val)}
                                            className="flex-1"
                                        />
                                        <ImageIcon className="h-5 w-5 text-foreground" />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Eye Icon (Visibility Toggle) */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleUnranked}
                        className="text-muted-foreground hover:text-primary"
                        title={showUnranked ? "Hide Unranked" : "Show Unranked"}
                    >
                        {showUnranked ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    </Button>

                    {canEdit && (
                        <Button
                            variant={isEditMode ? "default" : "ghost"}
                            size="icon"
                            onClick={onToggleEditMode}
                            className="transition-all"
                            title="Edit Tiers"
                        >
                            <Settings className={`h-4 w-4 ${isEditMode ? 'animate-spin-slow' : ''}`} />
                        </Button>
                    )}

                    {canEdit && (
                        <AddItemDialog
                            categoryId={category.id}
                            categoryName={category.name}
                            categoryMetadata={category.metadata}
                            trigger={
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white transition-colors gap-2 border-none">
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Add Item</span>
                                </Button>
                            }
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

