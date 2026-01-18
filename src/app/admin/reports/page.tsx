'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
    Flag, CheckCircle2, XCircle, RefreshCw,
    Clock, User, FileText, ExternalLink, Loader2, Eye, Save
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import Link from 'next/link'
import { getReports, getReportStats, resolveReport, type Report, type ReportStats, type ReportStatus } from '@/lib/actions/reports'
import { createClient } from '@/lib/supabase/client'

// ============================================================================
// CONFIG
// ============================================================================

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: 'Pending', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
    resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle2 },
    dismissed: { label: 'Dismissed', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: XCircle },
}

const REASON_LABELS: Record<string, string> = {
    inaccurate_data: 'Inaccurate Data',
    duplicate: 'Duplicate Entry',
    inappropriate: 'Inappropriate Content',
    other: 'Other Issue',
}

// ============================================================================
// TYPES
// ============================================================================

interface ItemData {
    id: string
    title: string
    description: string | null
    image_url: string | null
    category_type: string | null
    release_year: number | null
    // Media metadata
    genres: string[] | null
    director: string | null
    studio: string | null
    cast: string[] | null
    production_companies: string[] | null
    // Ratings
    vote_average: number | null
    content_rating: string | null
    runtime: number | null
    // TV/Anime
    number_of_seasons: number | null
    number_of_episodes: number | null
    episodes: number | null
    status: string | null
    // Gaming
    developers: string[] | null
    publishers: string[] | null
    platforms: string[] | Array<{ name?: string }> | null
    // Board Games
    designers: string[] | null
    min_players: number | null
    max_players: number | null
    complexity: number | null
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminReportsPage() {
    const [reports, setReports] = useState<Report[]>([])
    const [stats, setStats] = useState<ReportStats>({ pending: 0, resolved: 0, dismissed: 0, total: 0 })
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<ReportStatus | 'all'>('pending')

    // Review sheet state
    const [reviewReport, setReviewReport] = useState<Report | null>(null)
    const [itemData, setItemData] = useState<ItemData | null>(null)
    const [loadingItem, setLoadingItem] = useState(false)

    // Editable fields
    const [editTitle, setEditTitle] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [editImage, setEditImage] = useState('')

    // Action state
    const [isResolving, setIsResolving] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab])

    const loadData = async () => {
        setLoading(true)
        try {
            const [reportsData, statsData] = await Promise.all([
                getReports(activeTab === 'all' ? undefined : activeTab as ReportStatus),
                getReportStats(),
            ])
            setReports(reportsData.reports)
            setStats(statsData)
        } catch (_error) {
            toast.error('Failed to load reports')
        } finally {
            setLoading(false)
        }
    }

    // Open the review sheet and fetch item data
    const openReview = async (report: Report) => {
        setReviewReport(report)
        setLoadingItem(true)

        try {
            const { data, error } = await (supabase.from('global_items') as any)
                .select(`
                    id, title, description, image_url, category_type, release_year,
                    genres, director, studio, cast, production_companies,
                    vote_average, content_rating, runtime,
                    number_of_seasons, number_of_episodes, episodes, status,
                    developers, publishers, platforms,
                    designers, min_players, max_players, complexity
                `)
                .eq('id', report.globalItemId)
                .single()

            if (error) throw error

            setItemData(data)
            setEditTitle(data?.title || '')
            setEditDescription(data?.description || '')
            setEditImage(data?.image_url || '')
        } catch (error) {
            console.error('Failed to load item:', error)
            toast.error('Failed to load item data')
        } finally {
            setLoadingItem(false)
        }
    }

    const closeReview = () => {
        setReviewReport(null)
        setItemData(null)
    }

    // Dismiss report without changes
    const handleDismiss = async () => {
        if (!reviewReport) return

        setIsResolving(true)
        try {
            const result = await resolveReport(reviewReport.id, 'dismissed', 'No changes made')
            if (result.success) {
                toast.success('Report dismissed')
                closeReview()
                loadData()
            } else {
                toast.error(result.error || 'Failed to dismiss report')
            }
        } catch (_error) {
            toast.error('An unexpected error occurred')
        } finally {
            setIsResolving(false)
        }
    }

    // Update item and resolve report
    const handleUpdateAndResolve = async () => {
        if (!reviewReport || !itemData) return

        setIsResolving(true)
        try {
            // Check for changes and update item
            const updates: Record<string, string> = {}
            if (editTitle !== itemData.title) updates.title = editTitle
            if (editDescription !== (itemData.description || '')) updates.description = editDescription
            if (editImage !== (itemData.image_url || '')) updates.image_url = editImage

            const hasChanges = Object.keys(updates).length > 0

            if (hasChanges) {
                const { error } = await (supabase.from('global_items') as any)
                    .update(updates)
                    .eq('id', reviewReport.globalItemId)

                if (error) throw error
            }

            // Resolve the report
            const changedFields = Object.keys(updates)
            const notes = hasChanges
                ? `Item data updated: ${changedFields.join(', ')}`
                : 'Reviewed and confirmed data is correct'

            const result = await resolveReport(reviewReport.id, 'resolved', notes)

            if (result.success) {
                toast.success(hasChanges ? 'Item updated and report resolved' : 'Report resolved')
                closeReview()
                loadData()
            } else {
                toast.error(result.error || 'Failed to resolve report')
            }
        } catch (error) {
            console.error('Failed to update:', error)
            toast.error('Failed to update item')
        } finally {
            setIsResolving(false)
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <div className="container mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Flag className="w-8 h-8 text-amber-500" />
                    Report Management
                </h1>
                <p className="text-zinc-400 mt-2">Review and resolve user-submitted reports</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Total</p>
                                <p className="text-2xl font-bold text-white">{stats.total}</p>
                            </div>
                            <FileText className="w-8 h-8 text-zinc-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-950/20 border-amber-900/30">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-amber-500/80 uppercase tracking-wider">Pending</p>
                                <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                            </div>
                            <Clock className="w-8 h-8 text-amber-500/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-green-950/20 border-green-900/30">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-green-500/80 uppercase tracking-wider">Resolved</p>
                                <p className="text-2xl font-bold text-green-400">{stats.resolved}</p>
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-green-500/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Dismissed</p>
                                <p className="text-2xl font-bold text-zinc-400">{stats.dismissed}</p>
                            </div>
                            <XCircle className="w-8 h-8 text-zinc-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Reports List */}
            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="border-b border-zinc-800 pb-4">
                    <div className="flex items-center justify-between">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                            <TabsList className="bg-zinc-800/50">
                                <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                                    Pending ({stats.pending})
                                </TabsTrigger>
                                <TabsTrigger value="resolved" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                                    Resolved
                                </TabsTrigger>
                                <TabsTrigger value="dismissed" className="data-[state=active]:bg-zinc-700">
                                    Dismissed
                                </TabsTrigger>
                                <TabsTrigger value="all" className="data-[state=active]:bg-zinc-700">
                                    All
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="text-zinc-400">
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                            <CheckCircle2 className="w-12 h-12 mb-4 opacity-30" />
                            <p>No reports found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-800/50">
                            {reports.map((report) => {
                                const statusConfig = STATUS_CONFIG[report.status]
                                const StatusIcon = statusConfig.icon

                                return (
                                    <div key={report.id} className="p-4 hover:bg-zinc-800/30 transition-colors">
                                        <div className="flex gap-4">
                                            {/* Item Image */}
                                            <div className="w-16 h-24 rounded bg-zinc-800 overflow-hidden shrink-0 relative">
                                                {report.itemImage ? (
                                                    <Image src={report.itemImage} alt="" fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <FileText className="w-6 h-6 text-zinc-700" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Report Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="font-medium text-white truncate">
                                                            {report.itemTitle || 'Unknown Item'}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge className={`${statusConfig.color} border text-xs`}>
                                                                <StatusIcon className="w-3 h-3 mr-1" />
                                                                {statusConfig.label}
                                                            </Badge>
                                                            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                                                                {REASON_LABELS[report.reason] || report.reason}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    {/* Single Review Button */}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 text-cyan-400 border-cyan-900/50 hover:bg-cyan-950/50 shrink-0"
                                                        onClick={() => openReview(report)}
                                                    >
                                                        <Eye className="w-3.5 h-3.5 mr-1" />
                                                        Review
                                                    </Button>
                                                </div>

                                                {/* Details */}
                                                {report.details && (
                                                    <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                                                        {report.details}
                                                    </p>
                                                )}

                                                {/* Meta */}
                                                <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                                                    <span className="flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {report.reporterName || 'Anonymous'}
                                                    </span>
                                                    <span>{formatDate(report.createdAt)}</span>
                                                    <Link
                                                        href={`/admin/data-browser?id=${report.globalItemId}`}
                                                        className="text-cyan-500 hover:text-cyan-400 flex items-center gap-1"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        View Item
                                                    </Link>
                                                </div>

                                                {/* Resolution Notes */}
                                                {report.resolutionNotes && (
                                                    <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs text-zinc-400 border border-zinc-700/50">
                                                        <span className="text-zinc-500">Resolution notes:</span> {report.resolutionNotes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Review Sheet */}
            <Sheet open={!!reviewReport} onOpenChange={(open: boolean) => !open && closeReview()}>
                <SheetContent className="w-full sm:max-w-xl bg-zinc-950 border-zinc-800 flex flex-col p-0">
                    <SheetHeader className="px-6 pt-6 pb-4 border-b border-zinc-800 shrink-0">
                        <div className="flex items-center gap-2">
                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 border">
                                {REASON_LABELS[reviewReport?.reason || ''] || reviewReport?.reason}
                            </Badge>
                        </div>
                        <SheetTitle className="text-zinc-100 text-lg">
                            Review Report
                        </SheetTitle>
                        <SheetDescription className="text-zinc-400">
                            Reported by <span className="text-zinc-300">{reviewReport?.reporterName || 'Anonymous'}</span>
                            {reviewReport?.details && (
                                <span className="block mt-2 text-zinc-500 italic">"{reviewReport.details}"</span>
                            )}
                        </SheetDescription>
                    </SheetHeader>

                    <ScrollArea className="flex-1 px-6">
                        <div className="py-6 space-y-6">
                            {loadingItem ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                                </div>
                            ) : itemData ? (
                                <>
                                    {/* Section Header */}
                                    <h3 className="text-sm font-medium text-zinc-300">Item Data</h3>

                                    {/* Item Image */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-zinc-500 uppercase tracking-wider">Image</label>
                                        <div className="flex gap-4">
                                            <div className="w-24 h-36 rounded-lg bg-zinc-800 overflow-hidden shrink-0 relative border border-zinc-700">
                                                {editImage ? (
                                                    <Image
                                                        src={editImage}
                                                        alt=""
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <FileText className="w-8 h-8 text-zinc-700" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <Input
                                                    value={editImage}
                                                    onChange={(e) => setEditImage(e.target.value)}
                                                    placeholder="Image URL..."
                                                    className="bg-zinc-900 border-zinc-800 text-zinc-200"
                                                    disabled={reviewReport?.status !== 'pending'}
                                                />
                                                <p className="text-xs text-zinc-600 mt-1">Enter a new image URL</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="bg-zinc-800" />

                                    {/* Title */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-zinc-500 uppercase tracking-wider">Title</label>
                                        <Input
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            className="bg-zinc-900 border-zinc-800 text-zinc-200"
                                            disabled={reviewReport?.status !== 'pending'}
                                        />
                                    </div>

                                    {/* Description */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-zinc-500 uppercase tracking-wider">Description</label>
                                        <Textarea
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            rows={8}
                                            className="bg-zinc-900 border-zinc-800 text-zinc-200 resize-none max-h-[250px] overflow-y-auto whitespace-pre-wrap"
                                            disabled={reviewReport?.status !== 'pending'}
                                        />
                                        <p className="text-xs text-zinc-600">
                                            Tip: Use blank lines to separate paragraphs
                                        </p>
                                    </div>

                                    <Separator className="bg-zinc-800" />

                                    {/* Metadata Section (Read-Only) */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium text-zinc-300">Item Metadata</h3>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            {/* Category & Year */}
                                            {itemData.category_type && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Category</span>
                                                    <p className="text-zinc-300">{itemData.category_type.replace(/_/g, ' ')}</p>
                                                </div>
                                            )}
                                            {itemData.release_year && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Year</span>
                                                    <p className="text-zinc-300">{itemData.release_year}</p>
                                                </div>
                                            )}

                                            {/* Rating & Runtime */}
                                            {itemData.vote_average != null && itemData.vote_average > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Rating</span>
                                                    <p className="text-zinc-300">{itemData.vote_average.toFixed(1)}/10</p>
                                                </div>
                                            )}
                                            {itemData.runtime && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Runtime</span>
                                                    <p className="text-zinc-300">{itemData.runtime} min</p>
                                                </div>
                                            )}

                                            {/* TV/Anime Episodes */}
                                            {(itemData.number_of_episodes || itemData.episodes) && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Episodes</span>
                                                    <p className="text-zinc-300">{itemData.number_of_episodes || itemData.episodes}</p>
                                                </div>
                                            )}
                                            {itemData.number_of_seasons && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Seasons</span>
                                                    <p className="text-zinc-300">{itemData.number_of_seasons}</p>
                                                </div>
                                            )}

                                            {/* Board Game Players */}
                                            {(itemData.min_players || itemData.max_players) && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Players</span>
                                                    <p className="text-zinc-300">
                                                        {itemData.min_players === itemData.max_players
                                                            ? itemData.min_players
                                                            : `${itemData.min_players || '?'}-${itemData.max_players || '?'}`}
                                                    </p>
                                                </div>
                                            )}
                                            {itemData.complexity != null && itemData.complexity > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Complexity</span>
                                                    <p className="text-zinc-300">{itemData.complexity.toFixed(2)}/5</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Full Width Fields */}
                                        <div className="space-y-3">
                                            {/* Genres */}
                                            {itemData.genres && itemData.genres.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Genres</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {itemData.genres.map((g, i) => (
                                                            <Badge key={i} variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                                                                {g}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Director/Studio */}
                                            {itemData.director && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Director</span>
                                                    <p className="text-zinc-300 text-sm">{itemData.director}</p>
                                                </div>
                                            )}
                                            {itemData.studio && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Studio</span>
                                                    <p className="text-zinc-300 text-sm">{itemData.studio}</p>
                                                </div>
                                            )}

                                            {/* Developers/Publishers */}
                                            {itemData.developers && itemData.developers.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Developers</span>
                                                    <p className="text-zinc-300 text-sm">{itemData.developers.join(', ')}</p>
                                                </div>
                                            )}
                                            {itemData.publishers && itemData.publishers.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Publishers</span>
                                                    <p className="text-zinc-300 text-sm">{itemData.publishers.join(', ')}</p>
                                                </div>
                                            )}

                                            {/* Designers (Board Games) */}
                                            {itemData.designers && itemData.designers.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Designers</span>
                                                    <p className="text-zinc-300 text-sm">{itemData.designers.join(', ')}</p>
                                                </div>
                                            )}

                                            {/* Platforms */}
                                            {itemData.platforms && itemData.platforms.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Platforms</span>
                                                    <p className="text-zinc-300 text-sm">
                                                        {itemData.platforms.map(p => typeof p === 'string' ? p : p.name).filter(Boolean).join(', ')}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Cast (truncated) */}
                                            {itemData.cast && itemData.cast.length > 0 && (
                                                <div className="space-y-1">
                                                    <span className="text-xs text-zinc-500 uppercase">Cast</span>
                                                    <p className="text-zinc-300 text-sm line-clamp-2">
                                                        {itemData.cast.slice(0, 6).join(', ')}
                                                        {itemData.cast.length > 6 && ` +${itemData.cast.length - 6} more`}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                                    <FileText className="w-12 h-12 mb-4 opacity-30" />
                                    <p>Item not found</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Footer Actions */}
                    {reviewReport?.status === 'pending' && (
                        <SheetFooter className="px-6 pt-4 pb-6 mt-auto border-t border-zinc-800 shrink-0 gap-2 sm:gap-2">
                            <Button
                                variant="outline"
                                onClick={handleDismiss}
                                disabled={isResolving}
                                className="flex-1 border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                            >
                                {isResolving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <XCircle className="w-4 h-4 mr-2" />
                                )}
                                Dismiss Report
                            </Button>
                            <Button
                                onClick={handleUpdateAndResolve}
                                disabled={isResolving || !itemData}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white"
                            >
                                {isResolving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Update & Resolve
                            </Button>
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
