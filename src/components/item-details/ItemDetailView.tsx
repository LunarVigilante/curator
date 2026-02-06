'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { X, Menu, RefreshCw, Wand2, Pencil, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useUser } from '@/hooks/useUser'
import ReportItemDialog from '@/components/dialogs/ReportItemDialog'
import FixMatchDialog from '@/components/dialogs/FixMatchDialog'

// Types and Utils
import type { GlobalItem } from './types'
import { normalizeCategory } from './utils'

// Layouts
import { StandardLayout } from './layouts/StandardLayout'
import { MusicTrackLayout } from './layouts/MusicTrackLayout'
import { BookLayout } from './layouts/BookLayout'
import { TvShowLayout } from './layouts/TvShowLayout'

// ============================================================================
// PROPS
// ============================================================================

interface ItemDetailViewProps {
    item: GlobalItem | null
    isOpen: boolean
    onClose: () => void
    onEdit: (item: GlobalItem) => void
    onDelete: (id: string) => void
    onItemChange?: (item: GlobalItem) => void
}

// ============================================================================
// VISUALLY HIDDEN (Accessibility)
// ============================================================================

function VisuallyHidden({ children }: { children: React.ReactNode }) {
    return <span className="sr-only">{children}</span>
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
}

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }
}

const sidebarVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } }
}

const bgVariants = {
    hidden: { opacity: 0, scale: 1.1 },
    visible: { opacity: 1, scale: 1, transition: { duration: 1.2, ease: "easeOut" as const } }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ItemDetailView({
    item,
    isOpen,
    onClose,
    onEdit,
    onDelete,
    onItemChange
}: ItemDetailViewProps) {
    const { isAdmin } = useUser()
    const [reportOpen, setReportOpen] = useState(false)
    const [fixMatchOpen, setFixMatchOpen] = useState(false)
    const [descriptionExpanded, setDescriptionExpanded] = useState(false)
    const [_isLoadingFreshData, setIsLoadingFreshData] = useState(false)

    // Audio player state (for music tracks)
    const [isPlaying, setIsPlaying] = useState(false)
    const [audioProgress, setAudioProgress] = useState(0)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // Loading states for admin actions
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isRegenerating, setIsRegenerating] = useState(false)

    // Cleanup audio on close
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    // Use a ref to store onItemChange to avoid triggering effect on callback changes
    const onItemChangeRef = useRef(onItemChange)
    useEffect(() => {
        onItemChangeRef.current = onItemChange
    }, [onItemChange])

    // Track if we've already fetched for the current item to prevent loops
    const lastFetchedIdRef = useRef<string | null>(null)

    // CRITICAL: Fetch fresh data from database when modal opens
    // This ensures we always have the latest data from DB, not cached/stale data
    useEffect(() => {
        if (!isOpen || !item?.id) return

        // Prevent re-fetching for the same item
        if (lastFetchedIdRef.current === item.id) return
        lastFetchedIdRef.current = item.id

        const fetchFreshData = async () => {
            setIsLoadingFreshData(true)
            try {
                // Import supabase client dynamically to avoid SSR issues
                const { createClient } = await import('@/lib/supabase/client')
                const supabase = createClient()

                const { data, error } = await supabase
                    .from('global_items')
                    .select('*')
                    .eq('id', item.id)
                    .single()

                if (error) {
                    console.error('[ItemDetailView] Error fetching fresh data:', error)
                    return
                }

                if (data && onItemChangeRef.current) {
                    console.log('[ItemDetailView] ✅ Loaded fresh data from DB')
                    onItemChangeRef.current(data as GlobalItem)
                }
            } catch (err) {
                console.error('[ItemDetailView] Error fetching fresh data:', err)
            } finally {
                setIsLoadingFreshData(false)
            }
        }

        fetchFreshData()
    }, [isOpen, item?.id]) // Removed onItemChange - using ref instead

    // Reset fetch tracking when modal closes
    useEffect(() => {
        if (!isOpen) {
            lastFetchedIdRef.current = null
        }
    }, [isOpen])

    // Reset states on item change
    useEffect(() => {
        setDescriptionExpanded(false)
        setIsPlaying(false)
        setAudioProgress(0)
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }
    }, [item?.id])

    if (!item) return null

    // Determine category and layout
    const category = normalizeCategory(item.category_type)
    const isTV = category === 'TV' || category === 'TV_SHOW'
    const isVideoGame = category === 'VIDEO_GAME'
    const isMusicTrack = item.category_type === 'MUSIC_TRACK'
    const isBook = category === 'BOOK'

    // Audio player handler
    const handleTrackPlayPause = () => {
        if (!item.preview_url) return

        if (isPlaying && audioRef.current) {
            audioRef.current.pause()
            setIsPlaying(false)
        } else {
            if (!audioRef.current) {
                audioRef.current = new Audio(item.preview_url)
                audioRef.current.volume = 0.5
                audioRef.current.onended = () => {
                    setIsPlaying(false)
                    setAudioProgress(0)
                }
                audioRef.current.ontimeupdate = () => {
                    if (audioRef.current) {
                        setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)
                    }
                }
            }
            audioRef.current.play()
            setIsPlaying(true)
        }
    }

    // Background image logic - ALWAYS use poster with heavy blur per user preference
    const bgImage = item.image_url

    // Admin action handlers
    const handleRefreshMetadata = async () => {
        if (!isAdmin) return
        setIsRefreshing(true)
        try {
            const response = await fetch('/api/v1/ai/enrich-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, title: item.title, type: item.category_type, force: true })
            })
            if (response.ok) {
                const result = await response.json()
                // Update local state with enriched data
                if (result.enrichedData && onItemChange) {
                    onItemChange({ ...item, ...result.enrichedData })
                }
                toast.success(`Metadata refreshed! ${result.fieldsUpdated?.length || 0} fields updated.`)
            } else {
                toast.error('Failed to refresh metadata')
            }
        } catch (error) {
            console.error('Refresh metadata error:', error)
            toast.error('Failed to refresh metadata')
        } finally {
            setIsRefreshing(false)
        }
    }

    const handleRegenerateDescription = async () => {
        if (!isAdmin) return
        setIsRegenerating(true)
        try {
            const response = await fetch('/api/v1/ai/regenerate-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, title: item.title, type: item.category_type })
            })
            if (response.ok) {
                const result = await response.json()
                // Update local state with new description
                if (result.description && onItemChange) {
                    onItemChange({
                        ...item,
                        description: result.description,
                        description_parts: result.description_parts
                    })
                }
                toast.success('Description regenerated successfully!')
            } else {
                toast.error('Failed to regenerate description')
            }
        } catch (error) {
            console.error('Regenerate description error:', error)
            toast.error('Failed to regenerate description')
        } finally {
            setIsRegenerating(false)
        }
    }

    // Handler for clicking on a similar item - fetch and display in modal
    const handleSimilarItemClick = async (itemId: string) => {
        try {
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()

            const { data, error } = await supabase
                .from('global_items')
                .select('*')
                .eq('id', itemId)
                .single()

            if (error) {
                console.error('[ItemDetailView] Error fetching similar item:', error)
                toast.error('Failed to load item')
                return
            }

            if (data && onItemChange) {
                console.log('[ItemDetailView] ✅ Switching to similar item:', data.title)
                onItemChange(data as GlobalItem)
            }
        } catch (err) {
            console.error('[ItemDetailView] Error fetching similar item:', err)
            toast.error('Failed to load item')
        }
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent
                    showCloseButton={false}
                    className="max-w-7xl sm:max-w-7xl w-full h-[85vh] p-0 bg-zinc-950 flex flex-col overflow-hidden shadow-2xl rounded-2xl text-zinc-100 outline-none"
                >
                    <VisuallyHidden>
                        <DialogTitle>{item.title}</DialogTitle>
                        <DialogDescription>Details for {item.title}</DialogDescription>
                    </VisuallyHidden>

                    {/* --- Dynamic Background --- */}
                    <motion.div
                        className="absolute inset-0 z-0 bg-zinc-950"
                        variants={bgVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {bgImage && (
                            <>
                                <Image
                                    src={bgImage}
                                    alt="Background"
                                    fill
                                    className="object-none blur-[60px] opacity-80"
                                    style={{ objectPosition: 'center center' }}
                                    priority
                                    unoptimized
                                />
                                {/* Light overlay to maintain readability */}
                                <div className="absolute inset-0 bg-zinc-950/45" />
                                {/* Bottom fade for footer */}
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                            </>
                        )}
                    </motion.div>

                    {/* --- Layout Selection --- */}
                    {isMusicTrack ? (
                        <MusicTrackLayout
                            item={item}
                            isPlaying={isPlaying}
                            audioProgress={audioProgress}
                            onPlayPause={handleTrackPlayPause}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onReportOpen={() => setReportOpen(true)}
                            onClose={onClose}
                            onRefreshMetadata={isAdmin ? handleRefreshMetadata : undefined}
                            onRegenerateDescription={isAdmin ? handleRegenerateDescription : undefined}
                            isRefreshing={isRefreshing}
                            isRegenerating={isRegenerating}
                            containerVariants={containerVariants}
                            itemVariants={itemVariants}
                        />
                    ) : isBook ? (
                        <BookLayout
                            item={item}
                            descriptionExpanded={descriptionExpanded}
                            onToggleDescription={() => setDescriptionExpanded(!descriptionExpanded)}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onClose={onClose}
                            onRefreshMetadata={isAdmin ? handleRefreshMetadata : undefined}
                            onRegenerateDescription={isAdmin ? handleRegenerateDescription : undefined}
                            isRefreshing={isRefreshing}
                            isRegenerating={isRegenerating}
                            containerVariants={containerVariants}
                            itemVariants={itemVariants}
                            sidebarVariants={sidebarVariants}
                        />
                    ) : isTV ? (
                        <TvShowLayout
                            item={item}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onReportOpen={() => setReportOpen(true)}
                            onClose={onClose}
                            onItemChange={onItemChange ? (item) => item && onItemChange(item) : undefined}
                            onRefreshMetadata={isAdmin ? handleRefreshMetadata : undefined}
                            onRegenerateDescription={isAdmin ? handleRegenerateDescription : undefined}
                            onSimilarItemClick={handleSimilarItemClick}
                            isRefreshing={isRefreshing}
                            isRegenerating={isRegenerating}
                            containerVariants={containerVariants}
                            itemVariants={itemVariants}
                            sidebarVariants={sidebarVariants}
                        />
                    ) : (
                        <StandardLayout
                            item={item}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onReportOpen={() => setReportOpen(true)}
                            onClose={onClose}
                            onItemChange={onItemChange ? (item) => item && onItemChange(item) : undefined}
                            onRefreshMetadata={isAdmin ? handleRefreshMetadata : undefined}
                            onRegenerateDescription={isAdmin ? handleRegenerateDescription : undefined}
                            onSimilarItemClick={handleSimilarItemClick}
                            isRefreshing={isRefreshing}
                            isRegenerating={isRegenerating}
                            containerVariants={containerVariants}
                            itemVariants={itemVariants}
                            sidebarVariants={sidebarVariants}
                        />
                    )}

                    {/* Top Right Controls: Admin Menu + Close Button */}
                    <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                        {/* Admin Hamburger Menu */}
                        {isAdmin && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white"
                                    >
                                        <Menu className="w-5 h-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800">
                                    <DropdownMenuLabel className="text-zinc-400">Admin Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-zinc-800" />
                                    <DropdownMenuSeparator className="bg-zinc-800" />
                                    <DropdownMenuItem
                                        onClick={() => setFixMatchOpen(true)}
                                        className="text-zinc-100 focus:bg-zinc-800 cursor-pointer"
                                    >
                                        <Search className="w-4 h-4 mr-2" />
                                        Fix Match...
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={handleRefreshMetadata}
                                        disabled={isRefreshing}
                                        className="text-zinc-100 focus:bg-zinc-800 cursor-pointer"
                                    >
                                        <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                                        {isRefreshing ? 'Refreshing...' : 'Refresh Metadata'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={handleRegenerateDescription}
                                        disabled={isRegenerating}
                                        className="text-zinc-100 focus:bg-zinc-800 cursor-pointer"
                                    >
                                        <Wand2 className={cn("w-4 h-4 mr-2", isRegenerating && "animate-pulse")} />
                                        {isRegenerating ? 'Regenerating...' : 'Regen Description'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-zinc-800" />
                                    <DropdownMenuItem
                                        onClick={() => onEdit(item)}
                                        className="text-zinc-100 focus:bg-zinc-800 cursor-pointer"
                                    >
                                        <Pencil className="w-4 h-4 mr-2" />
                                        Edit Item
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => onDelete(item.id)}
                                        className="text-red-400 focus:bg-zinc-800 focus:text-red-400 cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Item
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Close Button */}
                        <Button
                            onClick={onClose}
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Report Dialog */}
            {reportOpen && (
                <ReportItemDialog
                    globalItemId={item.id}
                    itemTitle={item.title}
                    open={reportOpen}
                    onOpenChange={setReportOpen}
                />
            )}

            {/* Fix Match Dialog */}
            {fixMatchOpen && (
                <FixMatchDialog
                    item={item}
                    isOpen={fixMatchOpen}
                    onClose={() => setFixMatchOpen(false)}
                    onSuccess={(updatedItem) => {
                        if (onItemChange) onItemChange(updatedItem)
                    }}
                />
            )}
        </>
    )
}
