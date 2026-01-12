'use client'

import React from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
// import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import {
    Star, Play, Music,
    Tv, Film, Sparkles, Gamepad2, Dice5, BookOpen, Headphones,
    Trophy, Trash2, Pencil, Tag as TagIcon, ExternalLink,
    Users, Building, Clapperboard, Award
} from 'lucide-react'

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
}

interface ItemDetailViewProps {
    item: GlobalItem | null
    isOpen: boolean
    onClose: () => void
    onEdit: (item: GlobalItem) => void
    onDelete: (id: string) => void
}

// ============================================================================
// HELPERS
// ============================================================================

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

function getRTRatingColor(ratingRaw: string | null): string {
    if (!ratingRaw) return 'text-zinc-500'
    const val = parseInt(ratingRaw.replace(/\D/g, ''))
    if (isNaN(val)) return 'text-zinc-500'
    return val >= 60 ? 'text-green-500' : 'text-red-500'
}

function getLanguageName(code: string | null): string | null {
    if (!code) return null
    try {
        return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code.toUpperCase()
    } catch {
        return code.toUpperCase()
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
    if (cat.includes('MUSIC') || cat.includes('ALBUM')) return 'MUSIC'
    return 'UNKNOWN'
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

export default function ItemDetailView({ item, isOpen, onClose, onEdit, onDelete }: ItemDetailViewProps) {
    if (!item) return null

    const category = normalizeCategory(item.category_type)
    const isAnime = category === 'ANIME'
    const isTV = category === 'TV' || isAnime // Standardize Anime as TV-like for specs
    const CategoryIconComponent = getCategoryIcon(item.category_type)

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
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
    }

    const sidebarVariants = {
        hidden: { opacity: 0, x: -30 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
    }

    const bgVariants = {
        hidden: { opacity: 0, scale: 1.1 },
        visible: { opacity: 1, scale: 1, transition: { duration: 1.2, ease: "easeOut" } }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="max-w-[95vw] w-full h-[90vh] sm:max-w-[90vw] lg:max-w-7xl p-0 gap-0 bg-transparent border-none shadow-2xl overflow-hidden rounded-2xl flex flex-col md:flex-row text-zinc-100 outline-none"
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
                            {/* Base tint */}
                            <div className="absolute inset-0 bg-zinc-950/40" />

                            {/* Gradient from left (Sidebar) */}
                            <div className="absolute inset-y-0 left-0 w-[400px] bg-gradient-to-r from-zinc-950/90 via-zinc-950/50 to-transparent" />

                            {/* Gradient from bottom */}
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
                        </>
                    )}
                </motion.div>

                {/* --- Main Content Grid --- */}
                <div className="relative z-10 flex flex-col md:flex-row w-full h-full">

                    {/* --- LEFT COLUMN: Sidebar (Fixed Width) --- */}
                    <motion.div
                        className="w-full md:w-[320px] flex-shrink-0 flex flex-col p-6 md:p-8 border-r border-white/5 bg-zinc-950/30 backdrop-blur-md h-full overflow-hidden"
                        variants={sidebarVariants}
                        initial="hidden"
                        animate="visible"
                    >

                        {/* Poster Frame */}
                        <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/10 mb-6 group shrink-0">
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
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 backdrop-blur-sm">
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 transition-all scale-90 group-hover:scale-100" onClick={() => onEdit(item)} title="Edit">
                                    <Pencil className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full bg-white/10 hover:bg-red-500 text-white border border-white/20 transition-all scale-90 group-hover:scale-100" onClick={() => onDelete(item.id)} title="Delete">
                                    <Trash2 className="w-4 h-4" />
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

                        {/* Scrollable Metadata (Tags/Genres) */}
                        <ScrollArea className="flex-1 -mx-4 px-4">
                            <div className="space-y-6 pb-4">

                                {/* Status Priority for TV/Anime */}
                                {isTV && item.status && (
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                                            Status
                                        </h4>
                                        <Badge variant="outline" className={cn(
                                            "w-full justify-center py-1.5 border-0 font-bold tracking-wide uppercase text-xs",
                                            item.status.toLowerCase().includes('returning') ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20" :
                                                item.status.toLowerCase().includes('ended') || item.status.toLowerCase().includes('canceled') ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20" :
                                                    "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
                                        )}>
                                            {item.status}
                                        </Badge>
                                    </div>
                                )}

                                {/* Genres */}
                                {item.genres && item.genres.length > 0 && (
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

                                {/* Tags - More compact */}
                                {item.cached_tags && item.cached_tags.length > 0 && (
                                    <div className="space-y-2.5">
                                        <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                                            <TagIcon className="w-3 h-3" /> Tags
                                        </h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {item.cached_tags.slice(0, 20).map(tag => (
                                                <span key={tag.id} className="text-[11px] text-zinc-500 bg-black/40 px-2 py-0.5 rounded hover:text-zinc-300 hover:bg-black/60 transition-colors cursor-default border border-transparent hover:border-white/10">
                                                    #{tag.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </motion.div>

                    {/* --- RIGHT COLUMN: Content (Flexible) --- */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-b from-transparent to-black/20">

                        {/* Top Navigation / Close */}
                        <div className="absolute top-0 right-0 p-6 z-50 flex gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-zinc-400 hover:text-white rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md transition-colors"
                                onClick={onClose}
                            >
                                <X_Icon className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* 1. HERO HEADER Section */}
                        <motion.div
                            className="p-8 md:p-10 pb-6 shrink-0 relative"
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
                                    <p className="text-2xl text-zinc-400 italic font-serif opacity-80 mix-blend-screen">
                                        {item.romaji_title}
                                    </p>
                                )}
                            </div>

                            {/* Tagline & Ratings Row */}
                            <div className="flex flex-col gap-4">
                                {item.tagline && (
                                    <div className="flex items-center gap-4">
                                        <div className="w-1 h-8 bg-primary/60 rounded-full" />
                                        <p className="text-lg md:text-xl text-zinc-300 font-medium italic opacity-90 leading-tight">
                                            &ldquo;{item.tagline}&rdquo;
                                        </p>
                                    </div>
                                )}

                                {/* RATING BADGES - ANIME PRIORITY */}
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {/* AniList - Priority for Anime */}
                                    {isAnime && item.anilist_score && (
                                        <div className="flex items-center h-7 bg-[#02A9FF] text-white rounded overflow-hidden shadow-lg shadow-blue-900/20 group cursor-default">
                                            <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider group-hover:bg-black/20 transition-colors">
                                                AniList
                                            </div>
                                            <div className="px-2.5 h-full flex items-center font-black text-sm bg-white/10">
                                                {item.anilist_score}%
                                            </div>
                                        </div>
                                    )}

                                    {/* Standard Ratings */}
                                    {item.imdb_rating && (
                                        <div className="flex items-center h-7 bg-[#F5C518] text-black rounded overflow-hidden shadow-lg shadow-yellow-900/20">
                                            <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">IMDb</div>
                                            <div className="px-2.5 h-full flex items-center font-black text-sm">{item.imdb_rating}</div>
                                        </div>
                                    )}
                                    {item.rotten_tomatoes_rating && (
                                        <div className="flex items-center h-7 bg-[#FA320A] text-white rounded overflow-hidden shadow-lg shadow-red-900/20">
                                            <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">RT</div>
                                            <div className="px-2.5 h-full flex items-center font-black text-sm">{item.rotten_tomatoes_rating}</div>
                                        </div>
                                    )}
                                    {item.metacritic_rating && (
                                        <div className="flex items-center h-7 bg-[#66CC33] text-black rounded overflow-hidden shadow-lg shadow-green-900/20">
                                            <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">Meta</div>
                                            <div className="px-2.5 h-full flex items-center font-black text-sm">{item.metacritic_rating}</div>
                                        </div>
                                    )}
                                    {item.vote_average !== null && item.vote_average > 0 && (
                                        <div className="flex items-center h-7 bg-[#01B4E4] text-white rounded overflow-hidden shadow-lg shadow-sky-900/20">
                                            <div className="px-2 h-full flex items-center bg-black/10 font-bold text-[10px] uppercase tracking-wider">TMDB</div>
                                            <div className="px-2.5 h-full flex items-center font-black text-sm">{item.vote_average.toFixed(1)}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>

                        {/* 2. Scrollable Body Content */}
                        <ScrollArea className="flex-1 px-8 md:px-10 pb-10">
                            <motion.div
                                className="flex flex-col gap-10 max-w-5xl"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                            >

                                {/* Awards Highlight */}
                                {item.awards_text && (
                                    <motion.div variants={itemVariants} className="bg-amber-400/5 border border-amber-500/20 rounded-lg p-4 flex items-start gap-4 backdrop-blur-sm">
                                        <Trophy className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-100/90 leading-relaxed font-medium tracking-wide shadow-black drop-shadow-sm">{item.awards_text}</p>
                                    </motion.div>
                                )}

                                {/* Synopsis */}
                                {item.description && (
                                    <motion.div variants={itemVariants} className="prose prose-invert max-w-none">
                                        <p className="text-zinc-200/90 text-[1.1rem] leading-[1.8] font-light tracking-wide">{item.description}</p>
                                    </motion.div>
                                )}

                                {/* DATA GRID (Specs) */}
                                <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-8 py-8 border-t border-white/5 border-b border-white/5">

                                    {/* BLOCK 1: CREATIVE */}
                                    <div className="space-y-4">
                                        <h5 className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-1 flex items-center gap-2"><Pencil className="w-3 h-3" /> Creative</h5>
                                        {isAnime ? (
                                            <>
                                                {item.original_creator && <DetailRow label="Original Creator"><span className="text-white">{item.original_creator}</span></DetailRow>}
                                                {item.director && <DetailRow label="Director"><span className="text-white">{item.director}</span></DetailRow>}
                                                {item.writer && !item.original_creator && <DetailRow label="Writer"><span className="text-zinc-300">{item.writer}</span></DetailRow>}
                                            </>
                                        ) : (
                                            <>
                                                {item.director && <DetailRow label="Director"><span className="text-white">{item.director}</span></DetailRow>}
                                                {item.writer && <DetailRow label="Writer"><span className="text-zinc-300">{item.writer}</span></DetailRow>}
                                            </>
                                        )}
                                    </div>

                                    {/* BLOCK 2: PRODUCTION */}
                                    <div className="space-y-4">
                                        <h5 className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-1 flex items-center gap-2"><Building className="w-3 h-3" /> Production</h5>
                                        {isAnime ? (
                                            <>
                                                {item.studio && <DetailRow label="Studio"><span className="text-white font-bold">{item.studio}</span></DetailRow>}
                                                {item.source_material && <DetailRow label="Source"><span className="text-zinc-300">{item.source_material}</span></DetailRow>}
                                            </>
                                        ) : (
                                            <>
                                                {item.studio && <DetailRow label="Studio"><span className="text-white font-semibold">{item.studio}</span></DetailRow>}
                                                {isTV && item.networks && item.networks.length > 0 && (
                                                    <DetailRow label="Network"><span className="text-zinc-300">{item.networks[0]}</span></DetailRow>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* BLOCK 3: FORMAT */}
                                    <div className="space-y-4">
                                        <h5 className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-1 flex items-center gap-2"><Film className="w-3 h-3" /> Format</h5>
                                        {isAnime || isTV ? (
                                            <>
                                                {item.number_of_seasons && <DetailRow label="Seasons"><span className="text-white text-lg font-light">{item.number_of_seasons}</span></DetailRow>}
                                                {(item.episodes || item.number_of_episodes) && (
                                                    <DetailRow label="Episodes"><span className="text-white text-lg font-light">{item.episodes || item.number_of_episodes}</span></DetailRow>
                                                )}
                                                {formatRuntime(item.runtime) && <DetailRow label="Runtime"><span className="text-zinc-400">{formatRuntime(item.runtime)}</span></DetailRow>}
                                            </>
                                        ) : (
                                            <>
                                                {formatRuntime(item.runtime) && <DetailRow label="Runtime"><span className="text-white text-lg font-light">{formatRuntime(item.runtime)}</span></DetailRow>}
                                                {!isTV && item.budget && item.budget > 0 && <DetailRow label="Budget"><span className="text-zinc-400">{formatCurrency(item.budget)}</span></DetailRow>}
                                                {!isTV && item.box_office && item.box_office > 0 && <DetailRow label="Box Office"><span className="text-zinc-400">{formatCurrency(item.box_office)}</span></DetailRow>}
                                            </>
                                        )}
                                    </div>

                                    {/* BLOCK 4: INFO */}
                                    <div className="space-y-4">
                                        <h5 className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-1 flex items-center gap-2"><Sparkles className="w-3 h-3" /> Info</h5>
                                        {isAnime ? (
                                            <>
                                                {item.season && <DetailRow label="Season"><span className="capitalize text-pink-200">{item.season} {item.release_year}</span></DetailRow>}
                                                <DetailRow label="Status"><span className="text-zinc-400 capitalize">{item.status || 'Unknown'}</span></DetailRow>
                                            </>
                                        ) : (
                                            <>
                                                <DetailRow label="Language"><span className="text-zinc-300">{getLanguageName(item.original_language)}</span></DetailRow>
                                                {item.status && <DetailRow label="Status"><span className="text-zinc-400">{item.status}</span></DetailRow>}
                                            </>
                                        )}
                                    </div>

                                </motion.div>

                                {/* Cast Grid */}
                                {item.cast && item.cast.length > 0 && (
                                    <motion.div variants={itemVariants} className="space-y-4">
                                        <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                                            <Users className="w-4 h-4" /> {isAnime ? "Voice Cast" : "Cast"}
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {item.cast.slice(0, 15).map((actor) => (
                                                <div key={actor} className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium cursor-default transition-colors border border-white/5">
                                                    {actor}
                                                </div>
                                            ))}
                                            {item.cast.length > 15 && (
                                                <span className="text-xs text-zinc-600 self-center px-2 italic">+{item.cast.length - 15} more</span>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function X_Icon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6 6 18" />
            <path d="m6 6 18 18" />
        </svg>
    )
}
