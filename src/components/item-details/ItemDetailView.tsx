'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
    Star, Play, Pause, Music, X,
    Tv, Film, Sparkles, Gamepad2, Dice5, BookOpen,
    Trophy, Trash2, Pencil, Tag as TagIcon, ExternalLink,
    Users, Building, Clapperboard, Activity, Calendar, Flag, ChevronDown, ChevronUp, MoreHorizontal
} from 'lucide-react'
import { PlatformBadgeList } from '@/components/ui/PlatformBadge'
import ReportItemDialog from '@/components/dialogs/ReportItemDialog'
import TrackList from '@/components/music/TrackList'
import VibeMeter from '@/components/music/VibeMeter'
import { RelatedItemsRow } from './RelatedItemsRow'
import { useUser } from '@/hooks/useUser'

// ============================================================================
// TYPES
// ============================================================================

interface GlobalItem {
    id: string
    title: string
    description: string | null
    image_url: string | null
    backdrop_path: string | null
    category_type: string | null
    release_year: number | null

    // Metadata Bag (Legacy/Fallback)
    metadata: Record<string, any> | null

    // Tags (Joined format from DB usually, but UI might get them processed)
    // We stick to the existing pattern: cached_tags objects or flat tags?
    // The previous file used cached_tags: { id: string; name: string }[]
    cached_tags: { id: string; name: string }[] | null
    genres: string[] | null

    // Media
    cast: string[] | null
    director: string | null
    writer: string | null
    studio: string | null
    production_companies: string[] | null

    // Ratings & Tech
    content_rating: string | null
    runtime: number | null
    vote_average: number | null
    trailer_url: string | null
    tagline: string | null
    spotify_url: string | null
    url: string | null
    original_language: string | null

    // Movie Specifics
    budget: number | null
    revenue: number | null
    box_office: number | null
    rotten_tomatoes_rating: string | null
    metacritic_rating: string | null
    imdb_rating: string | null
    awards_text: string | null

    // TV Specifics
    status: string | null
    number_of_seasons: number | null
    number_of_episodes: number | null
    networks: string[] | null

    // Anime
    episodes: number | null
    romaji_title: string | null
    season: string | null
    source_material: string | null
    original_creator: string | null
    original_title: string | null
    anilist_score: number | null

    // Gaming
    developers: string[] | null
    publishers: string[] | null
    min_players: number | null
    max_players: number | null
    playing_time: number | null

    // Board Games
    min_playtime: number | null
    max_playtime: number | null
    min_age: number | null
    min_age_community: number | null
    best_players: string | null
    complexity: number | null
    rank_overall: number | null
    designers: string[] | null
    artists: string[] | null
    mechanics: string[] | null
    categories: string[] | null

    // Video Games
    themes: string[] | null
    game_modes: string[] | null
    platforms: string[] | Array<{ name?: string }> | null  // string[] is new format, object[] is legacy
    keywords: string[] | null
    time_to_beat: { main?: number; completionist?: number } | null
    logo_path: string | null
    vote_count: number | null

    // Board Games Additional
    families: string[] | null

    // Geography
    origin_countries: string[] | null

    // Music Albums
    label: string | null
    total_tracks: number | null
    album_type: string | null
    popularity: number | null
    artist_names: string[] | null
    album_name: string | null
    audio_features: {
        danceability?: number
        energy?: number
        valence?: number
        acousticness?: number
        tempo?: number
    } | null

    // Music Tracks
    preview_url: string | null
    duration_ms: number | null
    track_number: number | null

    // External IDs for linking
    external_ids: Record<string, string> | null
}

interface ItemDetailViewProps {
    item: GlobalItem | null
    isOpen: boolean
    onClose: () => void
    onEdit: (item: GlobalItem) => void
    onDelete: (id: string) => void
    /** Optional callback to update the displayed item (e.g., when clicking a related item) */
    onItemChange?: (item: GlobalItem) => void
}

// ============================================================================
// HELPERS
// ============================================================================

// Check if a value is valid for display (not null, undefined, 0, "N/A", "Unknown", empty)
function isValidValue(value: any): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'number' && value === 0) return false
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim()
        if (lower === '' || lower === 'n/a' || lower === 'unknown' || lower === 'null') return false
    }
    if (Array.isArray(value) && value.length === 0) return false
    return true
}

// Title case helper for source material, etc.
function toTitleCase(str: string | null): string | null {
    if (!str || !isValidValue(str)) return null
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// Format anime season string, avoiding duplicate year
function formatAnimeSeason(season: string | null, year: number | null): string | null {
    if (!season && !year) return null
    if (!season) return year?.toString() || null

    // Check if season already contains the year
    const seasonLower = season.toLowerCase()
    const yearStr = year?.toString() || ''
    if (yearStr && seasonLower.includes(yearStr)) {
        return toTitleCase(season)
    }
    return `${toTitleCase(season)} ${year || ''}`.trim()
}

function formatRuntime(minutes: number | null): string | null {
    if (!minutes || minutes === 0) return null
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
}

function formatCurrency(amount: number | string | null | undefined): string | null {
    if (amount === null || amount === undefined) return null
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num) || num === 0) return null

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(num)
}

function getLanguageName(code: string | null): string | null {
    if (!code || !isValidValue(code)) return null
    try {
        const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code)
        return name || null
    } catch {
        return null
    }
}

function getCountryName(code: string | null): string | null {
    if (!code || !isValidValue(code)) return null
    try {
        const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase())
        return name || null
    } catch {
        return null
    }
}

function getCategoryIcon(type: string | null) {
    const cat = type?.toUpperCase() || ''
    if (cat.includes('MOVIE')) return Film
    if (cat.includes('TV')) return Tv
    if (cat.includes('ANIME')) return Sparkles
    if (cat.includes('VIDEO') || (cat.includes('GAME') && !cat.includes('BOARD'))) return Gamepad2
    if (cat.includes('BOARD')) return Dice5
    if (cat.includes('MUSIC') || cat.includes('ALBUM')) return Music
    if (cat.includes('BOOK')) return BookOpen
    return Film
}

function normalizeCategory(category: string | null): string {
    const cat = category?.toUpperCase() || ''
    if (cat.includes('MOVIE')) return 'MOVIE'
    if (cat.includes('TV')) return 'TV'
    if (cat.includes('ANIME')) return 'ANIME'
    if (cat.includes('VIDEO') || (cat.includes('GAME') && !cat.includes('BOARD'))) return 'VIDEO_GAME'
    if (cat.includes('BOARD')) return 'BOARD_GAME'
    if (cat.includes('BOOK')) return 'BOOK'
    if (cat.includes('MUSIC') || cat.includes('ALBUM')) return 'MUSIC'
    return 'UNKNOWN'
}

// Clean title - removes artifacts like "..." and trims whitespace
function cleanTitle(title: string | null): string {
    if (!title) return ''
    return title
        .replace(/^\.{2,}\s*/g, '') // Remove leading ellipses
        .replace(/\s*\.{2,}$/g, '') // Remove trailing ellipses
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
}

// Get complexity data for board games (1-5 weight scale)
function getComplexityData(weight: number | null): { label: string; color: string } {
    if (!weight) return { label: 'Unknown', color: 'text-zinc-400' }
    if (weight <= 1.2) return { label: 'Very Simple', color: 'text-green-300' }  // Party games
    if (weight <= 2.4) return { label: 'Light', color: 'text-green-400' }        // Gateway games
    if (weight <= 3.2) return { label: 'Medium', color: 'text-yellow-400' }      // Standard Euro
    if (weight <= 3.8) return { label: 'Hard', color: 'text-orange-400' }        // Heavy Strategy
    return { label: 'Expert', color: 'text-red-500' }                            // Wargames/18xx
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function DetailRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    if (!children) return null
    return (
        <div className={cn("space-y-0.5", className)}>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{label}</span>
            <div className="text-zinc-200 text-sm font-medium leading-tight flex items-center gap-2">
                {children}
            </div>
        </div>
    )
}

function VisuallyHidden({ children }: { children: React.ReactNode }) {
    return <span className="sr-only">{children}</span>
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ItemDetailView({ item, isOpen, onClose, onEdit, onDelete, onItemChange }: ItemDetailViewProps) {
    const { isAdmin } = useUser()
    const [reportOpen, setReportOpen] = useState(false)
    const [descriptionExpanded, setDescriptionExpanded] = useState(false)
    const [trackFeatures, setTrackFeatures] = useState<any[]>([])
    const [_isLoadingRelated, _setIsLoadingRelated] = useState(false)

    // Track Player State
    const [isPlaying, setIsPlaying] = useState(false)
    const [audioProgress, setAudioProgress] = useState(0)
    const audioRef = React.useRef<HTMLAudioElement | null>(null)

    // Cleanup audio on close - MUST be before any early returns
    React.useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    if (!item) return null

    // Handler for related item clicks - fetches full item and updates modal
    const handleRelatedItemClick = async (itemId: string) => {
        if (!onItemChange) return

        _setIsLoadingRelated(true)
        try {
            const { createBrowserClient } = await import('@supabase/ssr')
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            )

            const { data, error } = await supabase
                .from('global_items')
                .select('*')
                .eq('id', itemId)
                .single()

            if (error) {
                console.error('Error fetching related item:', error)
                return
            }

            if (data) {
                onItemChange(data as GlobalItem)
            }
        } catch (err) {
            console.error('Error loading related item:', err)
        } finally {
            _setIsLoadingRelated(false)
        }
    }

    const category = normalizeCategory(item.category_type)
    const isAnime = category === 'ANIME'
    const isTV = category === 'TV' || category === 'TV_SHOW' || isAnime // Standardize Anime as TV-like for specs
    const isBoardGame = category === 'BOARD_GAME'
    const isVideoGame = category === 'VIDEO_GAME'
    const isBook = category === 'BOOK'
    const isMusicAlbum = item.category_type === 'MUSIC_ALBUM'
    const _isMusicArtist = item.category_type === 'MUSIC_ARTIST'
    const isMusicTrack = item.category_type === 'MUSIC_TRACK'
    const CategoryIconComponent = getCategoryIcon(item.category_type)

    // Data Fallback Strategy: Prefer top-level fields, fall back to metadata
    const metadata = item.metadata as Record<string, any> || {}
    const tagline = item.tagline || metadata.tagline
    const imdbRating = item.imdb_rating || metadata.imdb_rating
    const rtRating = item.rotten_tomatoes_rating || metadata.rotten_tomatoes_rating
    const mcRating = item.metacritic_rating || metadata.metacritic_rating
    const awardsText = item.awards_text || metadata.awards_text || metadata.awards

    // Cast: Robust fallback checking columns, metadata.cast, metadata.Actors, and metadata.credits.cast
    let cast = item.cast
    if (!cast || cast.length === 0) {
        if (metadata.cast && Array.isArray(metadata.cast)) cast = metadata.cast
        else if (metadata.Actors && typeof metadata.Actors === 'string') cast = metadata.Actors.split(',').map(s => s.trim())
        else if (metadata.credits?.cast && Array.isArray(metadata.credits.cast)) cast = metadata.credits.cast.map((c: any) => c.name || c)
    }

    const director = item.director || metadata.director
    const writer = item.writer || metadata.writer
    const originalCreator = item.original_creator || metadata.original_creator
    const createdByList = metadata.created_by
    const _createdBy = Array.isArray(createdByList) ? createdByList : (typeof createdByList === 'string' ? [createdByList] : undefined)

    const networks = item.networks || metadata.networks
    const numberOfSeasons = item.number_of_seasons || metadata.number_of_seasons || metadata.totalSeasons
    const numberOfEpisodes = item.number_of_episodes || metadata.number_of_episodes
    const runtime = item.runtime || metadata.runtime

    // Audio Player Helpers
    const formatDuration = (ms: number | null) => {
        if (!ms) return '--:--'
        const totalSeconds = Math.floor(ms / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    const getEnergyLevel = (energy: number | undefined) => {
        if (energy === undefined) return 'N/A'
        if (energy >= 0.7) return 'High'
        if (energy >= 0.4) return 'Medium'
        return 'Low'
    }

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

    // Background Logic
    const backdropPathRaw = item.backdrop_path
    const backdropUrl = backdropPathRaw
        ? (backdropPathRaw.startsWith('http') ? backdropPathRaw : `https://image.tmdb.org/t/p/original${backdropPathRaw}`)
        : null

    const posterUrl = item.image_url
    const bgImage = backdropUrl || posterUrl

    // Animations
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.1
            }
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

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent
                    showCloseButton={false}
                    className="max-w-7xl sm:max-w-7xl w-full h-[85vh] p-0 bg-zinc-950 flex flex-col overflow-hidden shadow-2xl rounded-2xl text-zinc-100 outline-none">

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
                                    alt="Backdrop"
                                    fill
                                    className={cn(
                                        "object-cover transition-opacity duration-700",
                                        !backdropUrl ? "blur-[120px] opacity-40 scale-105" : "opacity-30 blur-3xl scale-110"
                                    )}
                                    priority
                                    unoptimized
                                />
                                {/* Cinematic Gradient Overlays */}
                                {/* Base tint - reduced for more color bleed (stronger for video games) */}
                                <div className={cn(
                                    "absolute inset-0",
                                    isVideoGame ? "bg-zinc-950/50" : "bg-zinc-950/30"
                                )} />

                                {/* Gradient from left (Sidebar) */}
                                <div className={cn(
                                    "absolute inset-y-0 left-0 w-[400px] bg-gradient-to-r from-zinc-950/80 to-transparent",
                                    isVideoGame ? "via-zinc-950/60" : "via-zinc-950/40"
                                )} />

                                {/* Gradient from bottom - FULL HEIGHT to prevent color banding */}
                                <div className={cn(
                                    "absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent",
                                    isVideoGame ? "via-zinc-950/60" : "via-zinc-950/40"
                                )} />
                            </>
                        )}
                    </motion.div>

                    {/* --- Main Content Grid --- */}
                    {isMusicTrack ? (
                        /* ======== MUSIC TRACK PLAYER LAYOUT ======== */
                        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-8 md:p-12">
                            {/* Atmospheric Album Art Background */}
                            {item.image_url && (
                                <>
                                    <div
                                        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-40 scale-110"
                                        style={{ backgroundImage: `url(${item.image_url})` }}
                                    />
                                    <div className="absolute inset-0 bg-black/60" />
                                </>
                            )}
                            <motion.div
                                className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {/* Album Art with Glow */}
                                <motion.div variants={itemVariants} className="relative">
                                    <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20 ring-1 ring-white/10">
                                        {item.image_url ? (
                                            <Image
                                                src={item.image_url}
                                                alt={item.title}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                                <Music className="w-16 h-16 text-zinc-700" />
                                            </div>
                                        )}
                                    </div>
                                </motion.div>

                                {/* Track Info */}
                                <motion.div variants={itemVariants} className="text-center space-y-2">
                                    <h2 className="text-2xl md:text-3xl font-bold text-white">
                                        {item.title}
                                    </h2>
                                    {item.artist_names && item.artist_names.length > 0 && (
                                        <p className="text-zinc-400 text-lg">
                                            {item.artist_names.join(', ')}
                                        </p>
                                    )}
                                    {item.album_name && (
                                        <p className="text-zinc-500 text-sm">
                                            from <span className="text-cyan-400">{item.album_name}</span>
                                        </p>
                                    )}
                                </motion.div>

                                {/* Play Button - Smart Logic */}
                                {(item.preview_url || (item.metadata as Record<string, any>)?.external_ids?.spotify) && (
                                    <motion.div variants={itemVariants}>
                                        {item.preview_url ? (
                                            // Has preview: Show circular play button
                                            <Button
                                                size="lg"
                                                onClick={handleTrackPlayPause}
                                                aria-label={isPlaying ? "Pause preview" : "Play preview"}
                                                className="h-20 w-20 rounded-full transition-all duration-300 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/30 hover:scale-105"
                                            >
                                                {isPlaying ? (
                                                    <Pause className="w-8 h-8 fill-white text-white" />
                                                ) : (
                                                    <Play className="w-8 h-8 fill-white text-white ml-1" />
                                                )}
                                            </Button>
                                        ) : (item.metadata as Record<string, any>)?.external_ids?.spotify ? (
                                            // No preview but has Spotify: Show "Listen on Spotify" pill
                                            <Button
                                                asChild
                                                className="px-6 py-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white font-semibold transition-all duration-300 hover:scale-105 shadow-lg shadow-green-500/20"
                                            >
                                                <a
                                                    href={`https://open.spotify.com/track/${(item.metadata as Record<string, any>)?.external_ids?.spotify}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                                    </svg>
                                                    Listen on Spotify
                                                </a>
                                            </Button>
                                        ) : null}
                                    </motion.div>
                                )}

                                {/* Progress Bar */}
                                {item.preview_url && (
                                    <motion.div variants={itemVariants} className="w-full">
                                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-100"
                                                style={{ width: `${audioProgress}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-zinc-500 mt-1">
                                            <span>{isPlaying ? `${Math.floor(audioProgress * 0.3)}s` : '0:00'}</span>
                                            <span>{formatDuration(item.duration_ms)}</span>
                                        </div>
                                    </motion.div>
                                )}

                                {/* VibeMeter - Audio Features */}
                                {item.audio_features && (
                                    <motion.div variants={itemVariants} className="w-full bg-zinc-900/50 rounded-xl p-4 backdrop-blur-sm">
                                        <VibeMeter features={item.audio_features} />
                                    </motion.div>
                                )}

                                {/* Technical Specs Row - Only render if we have valid data */}
                                {(item.audio_features?.tempo || item.duration_ms || item.audio_features?.energy !== undefined) && (
                                    <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4 w-full">
                                        {item.audio_features?.tempo && (
                                            <div className="text-center p-3 bg-zinc-900/50 rounded-xl backdrop-blur-sm">
                                                <p className="text-2xl font-bold text-white">
                                                    {Math.round(item.audio_features.tempo)}
                                                </p>
                                                <p className="text-xs text-zinc-500 uppercase tracking-wider">BPM</p>
                                            </div>
                                        )}
                                        {item.duration_ms && (
                                            <div className="text-center p-3 bg-zinc-900/50 rounded-xl backdrop-blur-sm">
                                                <p className="text-2xl font-bold text-white">{formatDuration(item.duration_ms)}</p>
                                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Duration</p>
                                            </div>
                                        )}
                                        {item.audio_features?.energy !== undefined && (
                                            <div className="text-center p-3 bg-zinc-900/50 rounded-xl backdrop-blur-sm">
                                                <p className="text-2xl font-bold text-white">{getEnergyLevel(item.audio_features.energy)}</p>
                                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Energy</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* View Album Card */}
                                {item.album_name && (
                                    <motion.div variants={itemVariants} className="w-full">
                                        <Link
                                            href={`/search?q=${encodeURIComponent(item.album_name)}&type=music`}
                                            className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-xl hover:bg-zinc-800/60 transition-colors group"
                                        >
                                            <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                                                <Music className="w-6 h-6 text-cyan-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-zinc-400">View Album</p>
                                                <p className="text-white font-medium truncate group-hover:text-cyan-400 transition-colors">
                                                    {item.album_name}
                                                </p>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                                        </Link>
                                    </motion.div>
                                )}

                                {/* Action Buttons */}
                                <motion.div variants={itemVariants} className="flex gap-3 pt-4">
                                    <Button variant="outline" size="sm" className="text-zinc-400 border-zinc-700 hover:bg-zinc-800" onClick={() => onEdit(item)}>
                                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-zinc-400 border-zinc-700 hover:bg-zinc-800" onClick={() => setReportOpen(true)}>
                                        <Flag className="w-3.5 h-3.5 mr-1.5" /> Report
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-red-400 border-zinc-700 hover:bg-red-500/10" onClick={() => onDelete(item.id)}>
                                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                                    </Button>
                                </motion.div>
                            </motion.div>

                            {/* Close Button */}
                            <Button
                                onClick={onClose}
                                size="icon"
                                variant="ghost"
                                aria-label="Close details"
                                className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    ) : isBook ? (
                        /* ======== BOOK LAYOUT ======== */
                        <div className="relative z-10 flex flex-col md:flex-row w-full h-full">
                            {/* Atmospheric Book Cover Background */}
                            {item.image_url && (
                                <>
                                    <div
                                        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110"
                                        style={{ backgroundImage: `url(${item.image_url})` }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/90 via-zinc-950/80 to-zinc-950/70" />
                                </>
                            )}

                            {/* --- LEFT COLUMN: Book Cover --- */}
                            <motion.div
                                className="relative z-10 w-full md:w-[300px] flex-shrink-0 flex flex-col items-center p-6 md:p-8"
                                variants={sidebarVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {/* Book Cover */}
                                <div className="relative w-48 md:w-56 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 mb-6">
                                    {item.image_url ? (
                                        <Image
                                            src={item.image_url}
                                            alt={item.title}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                            <BookOpen className="w-16 h-16 text-zinc-700" />
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {item.external_ids?.google && (
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className="bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                                        >
                                            <a
                                                href={`https://books.google.com/books?id=${item.external_ids.google}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                                Preview
                                            </a>
                                        </Button>
                                    )}
                                    {(item.metadata as Record<string, any>)?.isbn && (
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className="bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                        >
                                            <a
                                                href={`https://www.goodreads.com/search?q=${(item.metadata as Record<string, any>)?.isbn}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Star className="w-3.5 h-3.5 mr-1.5" />
                                                Goodreads
                                            </a>
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" className="text-zinc-400 border-zinc-700 hover:bg-zinc-800" onClick={() => onEdit(item)}>
                                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-red-400 border-zinc-700 hover:bg-red-500/10" onClick={() => onDelete(item.id)}>
                                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                                    </Button>
                                </div>
                            </motion.div>

                            {/* --- RIGHT COLUMN: Content --- */}
                            <div className="relative z-10 flex-1 flex flex-col p-6 md:p-8 overflow-hidden">
                                {/* Close Button */}
                                <Button
                                    onClick={onClose}
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Close details"
                                    className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/20 hover:bg-black/40 text-white z-50"
                                >
                                    <X className="w-5 h-5" />
                                </Button>

                                <ScrollArea className="flex-1 -mx-2 px-2">
                                    <motion.div
                                        className="space-y-6"
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        {/* Header */}
                                        <motion.div variants={itemVariants}>
                                            <Badge variant="outline" className="mb-3 text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                                                <BookOpen className="w-3 h-3 mr-1" /> Book
                                            </Badge>
                                            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-2">
                                                {cleanTitle(item.title)}
                                            </h2>
                                            {/* Author Line */}
                                            {(item.metadata as Record<string, any>)?.authors && (
                                                <p className="text-lg text-zinc-400">
                                                    by <span className="text-cyan-400 font-medium">
                                                        {((item.metadata as Record<string, any>)?.authors as string[])?.join(', ')}
                                                    </span>
                                                </p>
                                            )}
                                            {item.release_year && (
                                                <p className="text-sm text-zinc-500 mt-1">{item.release_year}</p>
                                            )}
                                        </motion.div>

                                        {/* Enriched Metadata Grid */}
                                        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {(item.metadata as Record<string, any>)?.page_count && (
                                                <div className="bg-zinc-900/50 rounded-xl p-3 backdrop-blur-sm">
                                                    <p className="text-lg font-bold text-white">
                                                        {(item.metadata as Record<string, any>)?.page_count}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Pages</p>
                                                </div>
                                            )}
                                            {(item.metadata as Record<string, any>)?.publisher && (
                                                <div className="bg-zinc-900/50 rounded-xl p-3 backdrop-blur-sm">
                                                    <p className="text-sm font-medium text-white truncate" title={(item.metadata as Record<string, any>)?.publisher}>
                                                        {(item.metadata as Record<string, any>)?.publisher}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Publisher</p>
                                                </div>
                                            )}
                                            {(item.metadata as Record<string, any>)?.isbn && (
                                                <div className="bg-zinc-900/50 rounded-xl p-3 backdrop-blur-sm">
                                                    <p className="text-sm font-mono text-white">
                                                        {(item.metadata as Record<string, any>)?.isbn}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">ISBN</p>
                                                </div>
                                            )}
                                            {(item.metadata as Record<string, any>)?.average_rating && (
                                                <div className="bg-zinc-900/50 rounded-xl p-3 backdrop-blur-sm">
                                                    <p className="text-lg font-bold text-amber-400 flex items-center gap-1">
                                                        <Star className="w-4 h-4 fill-amber-400" />
                                                        {(item.metadata as Record<string, any>)?.average_rating}/5
                                                    </p>
                                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Rating</p>
                                                </div>
                                            )}
                                        </motion.div>

                                        {/* Genres */}
                                        {item.genres && item.genres.length > 0 && (
                                            <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
                                                {item.genres.slice(0, 8).map(genre => (
                                                    <Badge key={genre} variant="outline" className="text-zinc-400 border-white/10 bg-white/5">
                                                        {genre}
                                                    </Badge>
                                                ))}
                                            </motion.div>
                                        )}

                                        {/* Description with Read Deep Dive */}
                                        {item.description && (
                                            <motion.div variants={itemVariants} className="space-y-2">
                                                <div className={cn(
                                                    "text-zinc-300 text-sm leading-relaxed",
                                                    !descriptionExpanded && "line-clamp-4"
                                                )}>
                                                    <ReactMarkdown
                                                        components={{
                                                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                                                            em: ({ children }) => <em className="italic text-zinc-400">{children}</em>,
                                                        }}
                                                    >
                                                        {item.description}
                                                    </ReactMarkdown>
                                                </div>
                                                {item.description.length > 300 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                                                        className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 p-0 h-auto"
                                                    >
                                                        {descriptionExpanded ? (
                                                            <>
                                                                <ChevronUp className="w-4 h-4 mr-1" /> Show Less
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown className="w-4 h-4 mr-1" /> Read Deep Dive
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </motion.div>
                                        )}

                                        {/* Tags */}
                                        {item.cached_tags && item.cached_tags.length > 0 && (
                                            <motion.div variants={itemVariants} className="space-y-2">
                                                <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                                                    <TagIcon className="w-3 h-3" /> Tags
                                                </h4>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.cached_tags.slice(0, 15).map((tag, idx) => (
                                                        <span key={`${tag.id}-${idx}`} className="text-[11px] text-zinc-500 bg-black/40 px-2 py-0.5 rounded hover:text-zinc-300 hover:bg-black/60 transition-colors cursor-default border border-transparent hover:border-white/10">
                                                            #{tag.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                </ScrollArea>
                            </div>
                        </div>
                    ) : (
                        /* ======== STANDARD ARTICLE LAYOUT (Strict Flexbox) ======== */
                        <div className="flex flex-col md:flex-row h-full w-full overflow-hidden relative z-10">

                            {/* --- LEFT SIDEBAR: Fixed Width, Internal Scroll --- */}
                            <motion.div
                                className="w-full md:w-[320px] shrink-0 flex flex-col h-full border-r border-white/5 bg-black/20 overflow-hidden"
                                variants={sidebarVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {/* Top Section (Poster, Trailer, Genres) - shrink-0 */}
                                <div className="p-6 shrink-0">
                                    {/* Poster/Box Art Frame */}
                                    <div className={cn(
                                        "relative w-full rounded-lg overflow-hidden shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/10 mb-4 group",
                                        isBoardGame ? "aspect-square" : "aspect-[2/3]"
                                    )}>
                                        {item.image_url ? (
                                            <Image
                                                src={item.image_url}
                                                alt={item.title}
                                                fill
                                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                                {React.createElement(CategoryIconComponent, { className: "w-16 h-16 text-zinc-700" })}
                                            </div>
                                        )}

                                        {/* Poster Overlay Actions (Hover) */}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-sm">
                                            <Button size="icon" variant="secondary" aria-label="Edit item" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 transition-all scale-90 group-hover:scale-100" onClick={() => onEdit(item)} title="Edit">
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="secondary" aria-label="Delete item" className="h-10 w-10 rounded-full bg-white/10 hover:bg-red-500 text-white border border-white/20 transition-all scale-90 group-hover:scale-100" onClick={() => onDelete(item.id)} title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="secondary" aria-label="Report issue" className="h-10 w-10 rounded-full bg-white/10 hover:bg-amber-500 text-white border border-white/20 transition-all scale-90 group-hover:scale-100" onClick={() => setReportOpen(true)} title="Report">
                                                <Flag className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Primary Actions */}
                                    <div className="grid grid-cols-3 gap-3 mb-8 shrink-0">
                                        {item.trailer_url && (
                                            <Button variant="outline" className="col-span-1 h-12 bg-white/5 border-white/10 hover:bg-red-600 hover:border-red-500 hover:text-white text-zinc-400 p-0 flex flex-col gap-1 items-center justify-center transition-all group" asChild title="Trailer">
                                                <a href={item.trailer_url} target="_blank" rel="noopener noreferrer">
                                                    <Play className="w-4 h-4 group-hover:fill-current" />
                                                    <span className="text-[9px] uppercase tracking-wider font-bold">Trailer</span>
                                                </a>
                                            </Button>
                                        )}
                                        {item.spotify_url && (
                                            <Button variant="outline" className="col-span-1 h-12 bg-white/5 border-white/10 hover:bg-[#1DB954] hover:border-[#1DB954] hover:text-white text-zinc-400 p-0 flex flex-col gap-1 items-center justify-center transition-all group" asChild title="Spotify">
                                                <a href={item.spotify_url} target="_blank" rel="noopener noreferrer">
                                                    <Music className="w-4 h-4" />
                                                    <span className="text-[9px] uppercase tracking-wider font-bold">Music</span>
                                                </a>
                                            </Button>
                                        )}
                                        {item.url && (
                                            <Button variant="outline" className="col-span-1 h-12 bg-white/5 border-white/10 hover:bg-sky-500 hover:border-sky-500 hover:text-white text-zinc-400 p-0 flex flex-col gap-1 items-center justify-center transition-all group" asChild title="Visit">
                                                <a href={item.url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="w-4 h-4" />
                                                    <span className="text-[9px] uppercase tracking-wider font-bold">Link</span>
                                                </a>
                                            </Button>
                                        )}
                                    </div>

                                    {/* TV Status Badge - Below Primary Actions */}
                                    {isTV && item.status && (
                                        <div className={cn(
                                            "w-fit mx-auto px-4 py-1.5 rounded-full text-xs font-medium border mt-4 cursor-default",
                                            item.status.toLowerCase().includes('returning')
                                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                                : item.status.toLowerCase().includes('canceled')
                                                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                                                    : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
                                        )}>
                                            {item.status.toLowerCase().includes('returning') ? 'Returning Series' :
                                                item.status.toLowerCase().includes('canceled') ? 'Canceled' :
                                                    item.status.toLowerCase().includes('ended') ? 'Series Completed' :
                                                        item.status}
                                        </div>
                                    )}

                                </div>{/* End of fixed top section */}

                                {/* Bottom Section (Similar Items) - flex-1 overflow-y-auto min-h-0 */}
                                <div className="flex-1 overflow-y-auto min-h-0 p-6 pt-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                    <div className="space-y-6">

                                        {/* Genres - Skip for Video Games (merged into Tags) */}
                                        {!isVideoGame && item.genres && item.genres.length > 0 && (
                                            <div className="space-y-2.5">
                                                <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                                                    <Clapperboard className="w-3 h-3" /> Genres
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {item.genres.slice(0, 10).map(genre => (
                                                        <Badge key={genre} variant="outline" className="text-zinc-400 border-white/10 bg-white/5 hover:bg-white/10 hover:text-zinc-200 font-medium px-2.5 py-1 transition-colors cursor-default">
                                                            {genre}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Tags - More compact (includes Mechanics & Categories for Board Games) */}
                                        {(() => {
                                            // Build combined tags list (deduplicated)
                                            const baseTags = item.cached_tags || []

                                            // For board games and video games, merge additional taxonomy data
                                            let allTags = baseTags
                                            if (isBoardGame || isVideoGame) {
                                                const extraNames = new Set<string>()
                                                const baseNames = new Set(baseTags.map(t => t.name.toLowerCase()))

                                                // For board games: mechanics, categories, families
                                                // For video games: genres, keywords, themes
                                                const additionalItems = isBoardGame
                                                    ? [...(item.mechanics || []), ...(item.categories || []), ...(item.families || [])]
                                                    : [...(item.genres || []), ...(item.keywords || []), ...(item.themes || [])]

                                                additionalItems.forEach(name => {
                                                    const lowerName = name.toLowerCase()
                                                    if (!baseNames.has(lowerName) && !extraNames.has(lowerName)) {
                                                        extraNames.add(lowerName)
                                                    }
                                                })

                                                // Convert to tag objects
                                                const extraTags = Array.from(extraNames).map((name, i) => ({
                                                    id: `extra-${i}`,
                                                    name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                                                }))
                                                allTags = [...baseTags, ...extraTags]
                                            }

                                            if (allTags.length === 0) return null

                                            // Determine label based on content type
                                            const tagLabel = isBoardGame ? 'Mechanics & Tags' : isVideoGame ? 'Tags' : 'Tags'

                                            return (
                                                <div className="space-y-2.5">
                                                    <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                                                        <TagIcon className="w-3 h-3" /> {tagLabel}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {allTags.slice(0, 25).map((tag, idx) => (
                                                            <span key={`${tag.id}-${idx}`} className="text-[11px] text-zinc-500 bg-black/40 px-2 py-0.5 rounded hover:text-zinc-300 hover:bg-black/60 transition-colors cursor-default border border-transparent hover:border-white/10">
                                                                #{tag.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })()}

                                        {/* VibeMeter - Music Albums Only */}
                                        {isMusicAlbum && trackFeatures.length > 0 && (
                                            <div className="pt-4 border-t border-white/5">
                                                <VibeMeter features={trackFeatures} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Similar Items (also in scrollable section) */}
                                    <div className="hidden md:block mt-6 pt-6 border-t border-white/5">
                                        <RelatedItemsRow
                                            sourceItemId={item.id}
                                            matchCount={5}
                                            variant="compact"
                                            onItemClick={onItemChange ? handleRelatedItemClick : undefined}
                                        />
                                    </div>
                                </div>{/* End of scrollable bottom section */}
                            </motion.div>

                            {/* --- RIGHT COLUMN: Fluid Width, Internal Scroll --- */}
                            <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">

                                {/* Top Navigation / Close */}
                                <div className="absolute top-0 right-0 p-6 z-50 flex gap-2">
                                    {/* Actions Dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label="More options"
                                                className="h-10 w-10 text-zinc-400 hover:text-white rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md transition-colors"
                                            >
                                                <MoreHorizontal className="w-5 h-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-700">
                                            <DropdownMenuItem
                                                className="text-zinc-300 hover:text-white focus:text-white cursor-pointer"
                                                onClick={() => setReportOpen(true)}
                                            >
                                                <Flag className="w-4 h-4 mr-2" />
                                                Report Issue
                                            </DropdownMenuItem>

                                            {isAdmin && (
                                                <>
                                                    <DropdownMenuSeparator className="bg-zinc-700" />
                                                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">
                                                        Admin Tools
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuItem
                                                        className="text-zinc-300 hover:text-white focus:text-white cursor-pointer"
                                                        onClick={() => onEdit(item)}
                                                    >
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Edit Metadata
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-400 hover:text-red-300 focus:text-red-300 cursor-pointer"
                                                        onClick={() => onDelete(item.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Delete Item
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    {/* Close Button */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Close details"
                                        className="h-10 w-10 text-zinc-400 hover:text-white rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md transition-colors"
                                        onClick={onClose}
                                    >
                                        <X_Icon className="w-5 h-5" />
                                    </Button>
                                </div>

                                {/* Header (Title, Stats, Cast) - shrink-0 */}
                                <motion.div
                                    className="p-8 pb-4 shrink-0"
                                    variants={itemVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {/* Breadcrumb / Meta */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <Badge className="bg-white/10 text-white border-white/5 backdrop-blur-md px-3 py-1 text-xs font-bold tracking-wider uppercase hover:bg-white/20 transition-colors">
                                            {React.createElement(CategoryIconComponent, { className: "w-3 h-3 mr-2" })}
                                            {item.category_type?.replace(/_/g, ' ') || 'Unknown'}
                                        </Badge>
                                        {item.release_year && (
                                            <span className="text-sm font-bold text-zinc-400/80 tracking-wide font-mono px-2">{item.release_year}</span>
                                        )}
                                        {item.content_rating && (
                                            <span className="text-[10px] font-bold text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded bg-black/20">
                                                {item.content_rating}
                                            </span>
                                        )}
                                    </div>

                                    {/* Titles */}
                                    <div className="space-y-2 mb-6">
                                        <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[0.9] text-shadow-2xl max-w-4xl">
                                            {item.title}
                                        </h2>
                                        {isAnime && item.romaji_title && item.romaji_title !== item.title && (
                                            <p className="text-xl text-zinc-400 italic font-serif">
                                                {item.romaji_title}
                                            </p>
                                        )}
                                        {/* Music Album: Artist Subtitle with Clickable Link */}
                                        {isMusicAlbum && item.artist_names && item.artist_names.length > 0 && (
                                            <p className="text-lg text-zinc-400">
                                                By{' '}
                                                <Link
                                                    href={`/search?q=${encodeURIComponent(item.artist_names[0])}&type=music`}
                                                    className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors font-medium"
                                                >
                                                    {item.artist_names.join(', ')}
                                                </Link>
                                                {item.label && (
                                                    <span className="mx-2 text-zinc-600">•</span>
                                                )}
                                                {item.label && (
                                                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500 font-normal">
                                                        {item.label}
                                                    </Badge>
                                                )}
                                            </p>
                                        )}
                                        {/* Board Game: Designers Subtitle */}
                                        {isBoardGame && item.designers && item.designers.length > 0 && (
                                            <p className="text-base text-zinc-400">
                                                Designed by <span className="text-zinc-300 font-medium">{item.designers.slice(0, 3).join(', ')}</span>
                                            </p>
                                        )}
                                        {/* Video Game: Developer subtitle */}
                                        {isVideoGame && item.developers && item.developers.length > 0 && (
                                            <p className="text-base text-zinc-400">
                                                Developed by <span className="text-zinc-300 font-medium">{item.developers[0]}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Tagline & Ratings Row */}
                                    <div className="flex flex-col gap-4">
                                        {tagline && (
                                            <div className="flex items-center gap-4">
                                                <div className="w-1 h-8 bg-primary/60 rounded-full" />
                                                <p className="text-lg md:text-xl text-zinc-300 font-serif italic opacity-90 leading-tight">
                                                    &ldquo;{tagline}&rdquo;
                                                </p>
                                            </div>
                                        )}

                                        {/* RATING BADGES - ANIME PRIORITY */}
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            {/* Board Game: Rank Badge */}
                                            {isBoardGame && item.rank_overall && item.rank_overall < 500 && (
                                                <div className="flex items-center h-7 bg-amber-500/10 text-amber-500 rounded overflow-hidden border border-amber-500/20">
                                                    <div className="px-2 h-full flex items-center font-bold text-[10px] uppercase tracking-wider">
                                                        <Trophy className="w-3 h-3 mr-1" />
                                                        Rank
                                                    </div>
                                                    <div className="px-2.5 h-full flex items-center font-black text-sm bg-amber-500/10">
                                                        #{item.rank_overall}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Board Game: BGG Score */}
                                            {isBoardGame && item.vote_average !== null && item.vote_average > 0 && (
                                                <div className="flex items-center h-7 bg-[#FF5100] text-white rounded overflow-hidden shadow-lg shadow-orange-900/20">
                                                    <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">BGG</div>
                                                    <div className="px-2.5 h-full flex items-center font-black text-sm">{item.vote_average.toFixed(1)}</div>
                                                </div>
                                            )}

                                            {/* AniList - Priority for Anime (use anilist_score OR derive from vote_average) */}
                                            {isAnime && (item.anilist_score || (item.vote_average && item.vote_average > 0)) && (
                                                <div className="flex items-center h-7 bg-[#02A9FF] text-white rounded overflow-hidden shadow-lg shadow-blue-900/20 group cursor-default">
                                                    <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider group-hover:bg-black/20 transition-colors">
                                                        AniList
                                                    </div>
                                                    <div className="px-2.5 h-full flex items-center font-black text-sm bg-white/10">
                                                        {item.anilist_score ? `${item.anilist_score}%` : `${(item.vote_average! * 10).toFixed(0)}%`}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Video Game: IGDB Rating */}
                                            {isVideoGame && item.vote_average !== null && item.vote_average > 0 && (
                                                <div className="flex items-center h-7 bg-violet-500/10 text-violet-400 rounded overflow-hidden border border-violet-500/20">
                                                    <div className="px-2 h-full flex items-center font-bold text-[10px] uppercase tracking-wider">IGDB</div>
                                                    <div className="px-2.5 h-full flex items-center font-black text-sm bg-violet-500/10">{item.vote_average.toFixed(1)}</div>
                                                </div>
                                            )}

                                            {/* Standard Ratings */}
                                            {imdbRating && (
                                                <div className="flex items-center h-7 bg-[#F5C518] text-black rounded overflow-hidden shadow-lg shadow-yellow-900/20">
                                                    <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">IMDb</div>
                                                    <div className="px-2.5 h-full flex items-center font-black text-sm">{imdbRating}</div>
                                                </div>
                                            )}
                                            {rtRating && (
                                                <div className="flex items-center h-7 bg-[#FA320A] text-white rounded overflow-hidden shadow-lg shadow-red-900/20">
                                                    <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">RT</div>
                                                    <div className="px-2.5 h-full flex items-center font-black text-sm">{rtRating}</div>
                                                </div>
                                            )}
                                            {mcRating && (
                                                <div className="flex items-center h-7 bg-[#66CC33] text-black rounded overflow-hidden shadow-lg shadow-green-900/20">
                                                    <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">Meta</div>
                                                    <div className="px-2.5 h-full flex items-center font-black text-sm">{mcRating}</div>
                                                </div>
                                            )}
                                            {/* Spotify Popularity - Music Albums */}
                                            {isMusicAlbum && item.popularity != null && item.popularity > 0 && (
                                                <div className="flex items-center h-7 bg-[#1DB954] text-white rounded overflow-hidden shadow-lg shadow-green-900/20">
                                                    <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">
                                                        <Music className="w-3 h-3 mr-1" />
                                                        Pop
                                                    </div>
                                                    <div className="px-2.5 h-full flex items-center font-black text-sm">{item.popularity}</div>
                                                </div>
                                            )}
                                            {/* TMDB - Only for non-anime, non-board-game, non-music content */}
                                            {!isAnime && !isBoardGame && !isMusicAlbum && item.vote_average !== null && item.vote_average > 0 && (
                                                <div className="flex items-center h-7 bg-[#01B4E4] text-white rounded overflow-hidden shadow-lg shadow-sky-900/20">
                                                    <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">TMDB</div>
                                                    <div className="px-2.5 h-full flex items-center font-black text-sm">{item.vote_average.toFixed(1)}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>

                                {/* 2. Scrollable Body Content - Dynamic Fill Layout */}
                                {/* 2. Scrollable Body Content - Dynamic Fill Layout */}
                                <div className="flex-1 overflow-y-auto px-8 md:px-10 pb-10 min-h-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                    <motion.div
                                        className="flex flex-col gap-6 max-w-5xl h-full"
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >

                                        {/* Awards Banner - Smart display with conditional Tooltip */}
                                        {isValidValue(awardsText) && (() => {
                                            const processedAwardsText = awardsText || ''
                                            const awardsList = (item.metadata as Record<string, any>)?.awards_list as string[] | undefined
                                            const hasAwardsList = Array.isArray(awardsList) && awardsList.length > 0

                                            // Parse numbers from OMDB format: "Won X Oscars. Y wins & Z nominations"
                                            const oscarMatch = processedAwardsText.match(/won\s+(\d+)\s+oscar/i)
                                            const emmyMatch = processedAwardsText.match(/won\s+(\d+)\s+(?:primetime\s+)?emmy/i)
                                            const goldenGlobeMatch = processedAwardsText.match(/won\s+(\d+)\s+golden\s+globe/i)
                                            const totalWinsMatch = processedAwardsText.match(/(\d+)\s+wins?/i)
                                            const nominationsMatch = processedAwardsText.match(/(\d+)\s+nomination/i)

                                            const majorAwardCount = oscarMatch?.[1] || emmyMatch?.[1] || goldenGlobeMatch?.[1]
                                            const majorAwardType = oscarMatch ? 'Oscar' : emmyMatch ? 'Emmy' : goldenGlobeMatch ? 'Golden Globe' : null
                                            const totalWins = totalWinsMatch ? parseInt(totalWinsMatch[1]) : 0
                                            const nominations = nominationsMatch ? parseInt(nominationsMatch[1]) : 0

                                            // Build display string
                                            const parts: string[] = []
                                            if (majorAwardType && majorAwardCount) {
                                                parts.push(`${majorAwardCount} ${majorAwardType}${parseInt(majorAwardCount) > 1 ? 's' : ''}`)
                                            }
                                            if (totalWins > 0) {
                                                if (majorAwardCount && totalWins > parseInt(majorAwardCount)) {
                                                    parts.push(`${totalWins} wins total`)
                                                } else if (!majorAwardCount) {
                                                    parts.push(`${totalWins} wins`)
                                                }
                                            }
                                            if (nominations > 0 && totalWins < 50) {
                                                parts.push(`${nominations} nominations`)
                                            }
                                            const displayText = parts.length > 0 ? parts.join(' • ') : processedAwardsText

                                            const awardsBar = (
                                                <div className={cn(
                                                    "bg-amber-500/10 border border-amber-500/20 rounded py-2 px-3 flex items-center gap-3",
                                                    hasAwardsList && "cursor-help"
                                                )}>
                                                    <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                    <p className="text-sm text-amber-200 font-medium">{displayText}</p>
                                                </div>
                                            )

                                            return (
                                                <motion.div variants={itemVariants}>
                                                    {hasAwardsList ? (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    {awardsBar}
                                                                </TooltipTrigger>
                                                                <TooltipContent side="bottom" className="max-w-sm bg-zinc-900 border-zinc-700 text-zinc-200 p-3">
                                                                    <ul className="text-xs space-y-1">
                                                                        {awardsList.map((award, i) => (
                                                                            <li key={i} className="text-amber-200">• {award}</li>
                                                                        ))}
                                                                    </ul>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ) : (
                                                        awardsBar
                                                    )}
                                                </motion.div>
                                            )
                                        })()}

                                        {/* Cast Cloud - Limited to 6 */}
                                        {cast && cast.length > 0 && (
                                            <motion.div variants={itemVariants} className="space-y-2">
                                                <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                                                    <Users className="w-3.5 h-3.5" /> {isAnime ? "Voice Cast" : "Cast"}
                                                </h4>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {cast.slice(0, 6).map((actor, _idx) => {
                                                        // Get character name from metadata.credits if available
                                                        const credits = (item.metadata as Record<string, any>)?.credits?.cast as Array<{ name?: string; character?: string }> | undefined
                                                        const characterInfo = credits?.find((c: any) => c.name === actor)
                                                        const characterName = characterInfo?.character

                                                        return (
                                                            <span
                                                                key={actor}
                                                                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium cursor-default transition-colors border border-white/5"
                                                                title={characterName ? `as ${characterName}` : undefined}
                                                            >
                                                                {actor}
                                                            </span>
                                                        )
                                                    })}
                                                    {cast.length > 6 && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-medium cursor-help transition-colors border border-cyan-500/20 hover:bg-cyan-500/20">
                                                                        +{cast.length - 6} more
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="bottom" className="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-200 p-3">
                                                                    <p className="text-xs text-zinc-300">{cast.slice(6).join(', ')}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Platforms - Video Games Only */}
                                        {isVideoGame && item.platforms && Array.isArray(item.platforms) && item.platforms.length > 0 && (
                                            <motion.div variants={itemVariants} className="space-y-2">
                                                <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                                                    <Gamepad2 className="w-3.5 h-3.5" /> Platforms
                                                </h4>
                                                <PlatformBadgeList
                                                    platforms={item.platforms as string[]}
                                                    category="games"
                                                    showIcons={true}
                                                    limit={10}
                                                />
                                            </motion.div>
                                        )}

                                        {/* Synopsis - Scrollable Section */}
                                        {item.description && (
                                            <motion.div
                                                variants={itemVariants}
                                                className="flex-1 pl-4 pr-2"
                                            >
                                                <div className="space-y-2 py-2">
                                                    <ReactMarkdown
                                                        components={{
                                                            p: ({ children }) => <p className={cn(
                                                                "text-sm leading-relaxed mb-2",
                                                                isAnime ? "text-zinc-300/90 font-light" : "text-zinc-300"
                                                            )}>{children}</p>,
                                                            strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                                                            em: ({ children }) => <em className="text-zinc-200 italic">{children}</em>,
                                                            ul: ({ children }) => <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1 mb-2">{children}</ul>,
                                                            ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-zinc-300 space-y-1 mb-2">{children}</ol>,
                                                            li: ({ children }) => <li className="text-zinc-300">{children}</li>,
                                                            h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                                                            h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2">{children}</h2>,
                                                            h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-1">{children}</h3>,
                                                            blockquote: ({ children }) => <blockquote className="border-l-2 border-cyan-500/50 pl-3 text-zinc-400 italic my-2">{children}</blockquote>,
                                                        }}
                                                    >
                                                        {item.description}
                                                    </ReactMarkdown>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* TrackList - Music Albums Only */}
                                        {isMusicAlbum && item.title && (
                                            <motion.div variants={itemVariants} className="space-y-2 pt-4 border-t border-white/5">
                                                <TrackList
                                                    albumName={item.title}
                                                    artistNames={item.artist_names || []}
                                                    onFeaturesLoad={setTrackFeatures}
                                                />
                                            </motion.div>
                                        )}

                                        {/* Related Items - Standard variant for Mobile only (Desktop shows in sidebar) */}
                                        <motion.div variants={itemVariants} className="mt-8 md:hidden">
                                            <RelatedItemsRow
                                                sourceItemId={item.id}
                                                matchCount={6}
                                                variant="standard"
                                            />
                                        </motion.div>

                                    </motion.div>
                                </div>{/* End of Scrollable Body */}

                                {/* Metadata Footer Grid - Specialized for Anime vs Other */}
                                {isAnime ? (
                                    /* ========== ANIME DASHBOARD GRID ========== */
                                    (() => {
                                        const hasStudio = isValidValue(item.studio)
                                        const hasSeason = isValidValue(item.season) || isValidValue(item.release_year)
                                        const hasEpisodes = (item.episodes && item.episodes > 0) || (item.runtime && item.runtime > 0)
                                        const hasCreatives = isValidValue(item.director) || isValidValue(item.original_creator)

                                        if (!hasStudio && !hasSeason && !hasEpisodes && !hasCreatives) return null

                                        return (
                                            <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 py-6 border-t border-white/5 mt-2">

                                                {/* Col 1: Production (Crucial) */}
                                                {hasStudio && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Building className="w-3 h-3" /> Studio
                                                        </h5>
                                                        <div className="space-y-1">
                                                            <span className="text-white font-semibold text-sm block">{item.studio}</span>
                                                            {isValidValue(item.source_material) && (
                                                                <span className="text-zinc-500 text-xs block">Source: {toTitleCase(item.source_material)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Col 2: Release Context */}
                                                {hasSeason && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Calendar className="w-3 h-3" /> Season
                                                        </h5>
                                                        <div className="space-y-1">
                                                            <span className="text-pink-200 font-medium text-sm capitalize block">
                                                                {formatAnimeSeason(item.season, item.release_year)}
                                                            </span>
                                                            {isValidValue(item.status) && (
                                                                <span className="text-zinc-500 text-xs capitalize block">{item.status}</span>
                                                            )}
                                                            {/* Only show language if NOT Japanese (assumed default for anime) */}
                                                            {getLanguageName(item.original_language) &&
                                                                item.original_language !== 'ja' &&
                                                                item.original_language?.toLowerCase() !== 'japanese' && (
                                                                    <span className="text-zinc-500 text-xs block">{getLanguageName(item.original_language)}</span>
                                                                )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Col 3: Format */}
                                                {hasEpisodes && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Film className="w-3 h-3" /> Format
                                                        </h5>
                                                        <div className="space-y-1">
                                                            {item.episodes && item.episodes > 0 && (
                                                                <span className="text-white font-medium text-sm block">{item.episodes} eps</span>
                                                            )}
                                                            {item.runtime && item.runtime > 0 && (
                                                                <span className="text-zinc-500 text-xs block">{item.runtime}m per ep</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Col 4: Creatives */}
                                                {hasCreatives && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Pencil className="w-3 h-3" /> Creatives
                                                        </h5>
                                                        <div className="space-y-1">
                                                            {isValidValue(item.director) && (
                                                                <span className="text-sm block">
                                                                    <span className="text-zinc-500">Director: </span>
                                                                    <span className="text-zinc-200 font-medium">{item.director}</span>
                                                                </span>
                                                            )}
                                                            {isValidValue(item.original_creator) && (
                                                                <span className="text-sm block">
                                                                    <span className="text-zinc-500">Creator: </span>
                                                                    <span className="text-zinc-200 font-medium">{item.original_creator}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                            </motion.div>
                                        )
                                    })()
                                ) : isBoardGame ? (
                                    /* ========== BOARD GAME DASHBOARD GRID ========== */
                                    (() => {
                                        const hasPlayers = (item.min_players && item.min_players > 0) || (item.max_players && item.max_players > 0)
                                        const hasTime = (item.min_playtime && item.min_playtime > 0) || (item.max_playtime && item.max_playtime > 0) || (item.min_age && item.min_age > 0)
                                        const hasComplexity = item.complexity !== null && item.complexity > 0
                                        const hasProduction = (item.publishers && item.publishers.length > 0) || (item.artists && item.artists.length > 0)

                                        if (!hasPlayers && !hasTime && !hasComplexity && !hasProduction) return null

                                        return (
                                            <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 py-6 border-t border-white/5 mt-2">

                                                {/* Col 1: Player Count */}
                                                {hasPlayers && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Users className="w-3 h-3" /> Players
                                                        </h5>
                                                        <div className="space-y-1">
                                                            <span className="text-white font-semibold text-sm block">
                                                                {item.min_players === item.max_players
                                                                    ? `${item.min_players}`
                                                                    : `${item.min_players || '?'}-${item.max_players || '?'}`
                                                                }
                                                            </span>
                                                            {item.best_players && (
                                                                <span className="text-green-400 text-xs block font-medium">
                                                                    Best: {item.best_players}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Col 2: Time & Age */}
                                                {hasTime && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Activity className="w-3 h-3" /> Playtime
                                                        </h5>
                                                        <div className="space-y-1">
                                                            {(item.min_playtime || item.max_playtime) && (
                                                                <span className="text-white font-medium text-sm block">
                                                                    {item.min_playtime === item.max_playtime
                                                                        ? `${item.min_playtime} Min`
                                                                        : `${item.min_playtime || '?'}-${item.max_playtime || '?'} Min`
                                                                    }
                                                                </span>
                                                            )}
                                                            {(item.min_age || item.min_age_community) && (
                                                                <span className="text-zinc-500 text-xs block">
                                                                    Age: {item.min_age_community || item.min_age}+
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Col 3: Complexity */}
                                                {hasComplexity && (() => {
                                                    const { label, color } = getComplexityData(item.complexity)
                                                    return (
                                                        <div className="space-y-3">
                                                            <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                                <Dice5 className="w-3 h-3" /> Complexity
                                                            </h5>
                                                            <div className="space-y-1">
                                                                <span className={cn("font-semibold text-sm block", color)}>
                                                                    {label}
                                                                </span>
                                                                <span className="text-zinc-500 text-xs block">
                                                                    ({item.complexity!.toFixed(1)} / 5)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })()}

                                                {/* Col 4: Production */}
                                                {hasProduction && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Building className="w-3 h-3" /> Publisher
                                                        </h5>
                                                        <div className="space-y-1">
                                                            {item.publishers && item.publishers.length > 0 && (
                                                                <span className="text-white font-medium text-sm block">{item.publishers[0]}</span>
                                                            )}
                                                            {item.artists && item.artists.length > 0 && (
                                                                <span className="text-zinc-500 text-xs block">Art: {item.artists[0]}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                            </motion.div>
                                        )
                                    })()
                                ) : isVideoGame ? (
                                    /* ========== VIDEO GAME DASHBOARD GRID ========== */
                                    (() => {
                                        const ttb = item.time_to_beat as { main?: number; completionist?: number } | null
                                        const gameModes = item.game_modes as string[] | null

                                        // Determine what data we have for each column
                                        const hasLengthOrMode = (ttb?.main) || (gameModes && gameModes.length > 0)
                                        const hasDeveloper = (item.developers && item.developers.length > 0) || (item.publishers && item.publishers.length > 0)
                                        const hasGenre = item.genres && item.genres.length > 0
                                        const hasScore = item.vote_average !== null && item.vote_average > 0

                                        // Only render grid if we have something
                                        if (!hasLengthOrMode && !hasDeveloper && !hasGenre && !hasScore) return null

                                        return (
                                            <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 py-6 border-t border-white/5 mt-2">

                                                {/* Col 1: Length / Mode */}
                                                {hasLengthOrMode && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Activity className="w-3 h-3" /> Length / Mode
                                                        </h5>
                                                        <div className="space-y-1">
                                                            <span className="text-white font-semibold text-sm block">
                                                                {ttb?.main ? `${ttb.main}h` : (gameModes?.[0] || 'N/A')}
                                                            </span>
                                                            {ttb?.completionist && (
                                                                <span className="text-zinc-500 text-xs block">
                                                                    {ttb.completionist}h (100%)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Col 2: Developer */}
                                                {hasDeveloper && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Building className="w-3 h-3" /> Developer
                                                        </h5>
                                                        <div className="space-y-1">
                                                            <span className="text-white font-medium text-sm block">
                                                                {item.developers?.[0] || item.publishers?.[0] || 'Unknown'}
                                                            </span>
                                                            {item.developers?.[0] && item.publishers?.[0] && (
                                                                <span className="text-zinc-500 text-xs block">Pub: {item.publishers[0]}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Col 3: Genre */}
                                                {item.genres && item.genres.length > 0 && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Gamepad2 className="w-3 h-3" /> Genre
                                                        </h5>
                                                        <div className="space-y-1">
                                                            <span className="text-white font-medium text-sm block">{item.genres[0]}</span>
                                                            {item.genres.length > 1 && (
                                                                <span className="text-zinc-500 text-xs block">{item.genres.slice(1, 3).join(', ')}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Col 4: IGDB Score */}
                                                {hasScore && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Star className="w-3 h-3" /> IGDB Score
                                                        </h5>
                                                        <div className="space-y-1">
                                                            <span className="text-violet-400 font-semibold text-sm block">
                                                                {item.vote_average!.toFixed(1)}
                                                            </span>
                                                            {item.vote_count !== null && item.vote_count > 0 && (
                                                                <span className="text-zinc-500 text-xs block">
                                                                    ({item.vote_count} Reviews)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                            </motion.div>
                                        )
                                    })()
                                ) : (
                                    /* ======== STANDARD MOVIE/TV DASHBOARD GRID ======== */
                                    (() => {
                                        // Extract TV-specific metadata
                                        const metadata = item.metadata as Record<string, any> || {}
                                        const createdBy = metadata.created_by as string[] | undefined
                                        const episodeRunTime = metadata.episode_run_time as number[] | undefined
                                        const firstAirDate = item.release_year || (metadata.first_air_date as string)?.slice(0, 4)
                                        const lastAirDate = metadata.last_air_date as string
                                        const statusLower = item.status?.toLowerCase() || ''
                                        const isEnded = statusLower.includes('ended') || statusLower.includes('canceled')
                                        const isCanceled = statusLower.includes('canceled')
                                        const isMiniseries = metadata.type?.toLowerCase() === 'miniseries'
                                        const _isReturning = statusLower.includes('returning') || statusLower.includes('production')
                                        const sourceMaterial = metadata.source_material as string | undefined

                                        // Build air date range for TV - Fixed logic
                                        const getAirDateRange = () => {
                                            if (!firstAirDate) return null
                                            const startYear = typeof firstAirDate === 'number' ? String(firstAirDate) : firstAirDate
                                            const endYear = lastAirDate?.slice(0, 4)

                                            // Ended/Canceled: show actual end year (or just start year if same/no data)
                                            if (isEnded) {
                                                if (!endYear || startYear === endYear) return startYear
                                                return `${startYear} - ${endYear}`
                                            }

                                            // Returning/In Production: show "Present"
                                            return `${startYear} - Present`
                                        }

                                        // Format avg episode runtime
                                        const avgRuntime = episodeRunTime && episodeRunTime.length > 0
                                            ? `${episodeRunTime[0]}m`
                                            : null

                                        // Check column visibility
                                        const hasCreative = (createdBy && createdBy.length > 0) || isValidValue(originalCreator) || isValidValue(sourceMaterial) || isValidValue(director) || isValidValue(writer)
                                        const hasProduction = isValidValue(item.studio) || (networks && networks.length > 0) || isValidValue(item.source_material)
                                        const hasFormat = formatRuntime(runtime) || (numberOfSeasons && numberOfSeasons > 0) || (item.episodes && item.episodes > 0) || (numberOfEpisodes && numberOfEpisodes > 0) || formatCurrency(item.budget) || formatCurrency(item.box_office) || avgRuntime
                                        const hasInfo = getLanguageName(item.original_language) || isValidValue(item.status) || (item.origin_countries && item.origin_countries.length > 0) || (isTV && firstAirDate)

                                        if (!hasCreative && !hasProduction && !hasFormat && !hasInfo) return null

                                        return (
                                            <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 py-6 border-t border-white/5 mt-2">

                                                {/* BLOCK 1: CREATIVE */}
                                                {hasCreative && (
                                                    <div className="space-y-3 pl-4">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5"><Pencil className="w-3 h-3" /> Creative</h5>
                                                        <div className="space-y-1">
                                                            {isTV ? (
                                                                <>
                                                                    {createdBy && createdBy.length > 0 && (
                                                                        <DetailRow label="Created By"><span className="text-white">{createdBy.slice(0, 2).join(', ')}{createdBy.length > 2 ? '...' : ''}</span></DetailRow>
                                                                    )}
                                                                    {(!createdBy || createdBy.length === 0) && (
                                                                        <>
                                                                            {isValidValue(director) && <DetailRow label="Director"><span className="text-white">{director}</span></DetailRow>}
                                                                            {isValidValue(writer) && <DetailRow label="Writer"><span className="text-zinc-300">{writer}</span></DetailRow>}
                                                                        </>
                                                                    )}
                                                                    {isValidValue(sourceMaterial) && (
                                                                        <DetailRow label="Based On"><span className="text-zinc-400 italic">{sourceMaterial}</span></DetailRow>
                                                                    )}
                                                                    {isValidValue(originalCreator) && <DetailRow label="Original Creator"><span className="text-zinc-300">{originalCreator}</span></DetailRow>}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {isValidValue(director) && <DetailRow label="Director"><span className="text-white">{director}</span></DetailRow>}
                                                                    {isValidValue(sourceMaterial) && (
                                                                        <DetailRow label="Based On"><span className="text-zinc-400 italic">{sourceMaterial}</span></DetailRow>
                                                                    )}
                                                                    {isValidValue(writer) && <DetailRow label="Writer"><span className="text-zinc-300">{writer}</span></DetailRow>}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* BLOCK 2: PRODUCTION */}
                                                {hasProduction && (
                                                    <div className="space-y-3 pl-4">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5"><Building className="w-3 h-3" /> Production</h5>
                                                        <div className="space-y-1">
                                                            {isTV && networks && networks.length > 0 && (
                                                                <DetailRow label="Network"><span className="text-white font-medium">{networks[0]}</span></DetailRow>
                                                            )}
                                                            {isValidValue(item.studio) && (
                                                                <DetailRow label="Studio"><span className={isTV ? "text-zinc-400" : "text-white font-medium"}>{item.studio}</span></DetailRow>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* BLOCK 3: FORMAT */}
                                                {hasFormat && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5"><Film className="w-3 h-3" /> Format</h5>
                                                        {isTV ? (
                                                            <>
                                                                {numberOfSeasons && numberOfSeasons > 0 && <DetailRow label="Seasons"><span className="text-white">{numberOfSeasons}</span></DetailRow>}
                                                                {((item.episodes && item.episodes > 0) || (numberOfEpisodes && numberOfEpisodes > 0)) && (
                                                                    <DetailRow label="Episodes"><span className="text-white">{item.episodes || numberOfEpisodes}</span></DetailRow>
                                                                )}
                                                                {avgRuntime && <DetailRow label="Avg Runtime"><span className="text-zinc-400">{avgRuntime}</span></DetailRow>}
                                                            </>
                                                        ) : (
                                                            <>
                                                                {formatRuntime(runtime) && <DetailRow label="Runtime"><span className="text-white">{formatRuntime(runtime)}</span></DetailRow>}
                                                                {formatCurrency(item.budget) && <DetailRow label="Budget"><span className="text-zinc-400">{formatCurrency(item.budget)}</span></DetailRow>}
                                                                {(formatCurrency(item.revenue) || formatCurrency((item.metadata as Record<string, any>)?.revenue)) && (
                                                                    <DetailRow label="Revenue"><span className="text-green-400">{formatCurrency(item.revenue) || formatCurrency((item.metadata as Record<string, any>)?.revenue)}</span></DetailRow>
                                                                )}
                                                                {formatCurrency(item.box_office) && <DetailRow label="Box Office"><span className="text-zinc-400">{formatCurrency(item.box_office)}</span></DetailRow>}
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {/* BLOCK 4: RUN / INFO */}
                                                {hasInfo && (
                                                    <div className="space-y-3">
                                                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Sparkles className="w-3 h-3" /> {isTV ? 'Run' : 'Info'}
                                                        </h5>
                                                        {isTV ? (
                                                            <>
                                                                {getAirDateRange() && (
                                                                    <div className="flex items-center gap-1.5 text-sm">
                                                                        <span className="text-white">{getAirDateRange()}</span>
                                                                        {isCanceled && (
                                                                            <span className="text-red-400 text-xs">(Canceled)</span>
                                                                        )}
                                                                        {!isCanceled && isMiniseries && isEnded && (
                                                                            <span className="text-zinc-500 text-xs">(Miniseries)</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {getLanguageName(item.original_language) && <DetailRow label="Language"><span className="text-zinc-400">{getLanguageName(item.original_language)}</span></DetailRow>}
                                                            </>
                                                        ) : (
                                                            <>
                                                                {getLanguageName(item.original_language) && <DetailRow label="Language"><span className="text-zinc-300">{getLanguageName(item.original_language)}</span></DetailRow>}
                                                                {item.origin_countries && item.origin_countries.length > 0 && getCountryName(item.origin_countries[0]) && (
                                                                    <DetailRow label="Country"><span className="text-zinc-300">{getCountryName(item.origin_countries[0])}</span></DetailRow>
                                                                )}
                                                                {isValidValue(item.status) && <DetailRow label="Status"><span className="text-zinc-400">{item.status}</span></DetailRow>}
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                            </motion.div>
                                        )
                                    })()
                                )}

                            </div >
                        </div >
                    )}
                </DialogContent >
            </Dialog >

            {/* Report Dialog */}
            < ReportItemDialog
                globalItemId={item.id}
                itemTitle={item.title}
                open={reportOpen}
                onOpenChange={setReportOpen}
            />
        </>
    )
}

function X_Icon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}
