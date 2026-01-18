'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
    Music, Play, Pause, Pencil, Flag, Trash2, ExternalLink,
    RefreshCw, Wand2, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GlobalItem } from '../types'
import { formatDuration, getEnergyLevel } from '../utils'

// Lazy load VibeMeter to avoid circular dependencies
const VibeMeter = React.lazy(() => import('@/components/music/VibeMeter'))

interface MusicTrackLayoutProps {
    item: GlobalItem
    isPlaying: boolean
    audioProgress: number
    onPlayPause: () => void
    onEdit: (item: GlobalItem) => void
    onDelete: (id: string) => void
    onReportOpen: () => void
    onClose: () => void
    onRefreshMetadata?: () => void
    onRegenerateDescription?: () => void
    isRefreshing?: boolean
    isRegenerating?: boolean
    containerVariants: any
    itemVariants: any
}

/**
 * Full-screen music track player layout with album art, play controls, and audio features
 */
export function MusicTrackLayout({
    item,
    isPlaying,
    audioProgress,
    onPlayPause,
    onEdit,
    onDelete,
    onReportOpen,
    onClose,
    onRefreshMetadata,
    onRegenerateDescription,
    isRefreshing,
    isRegenerating,
    containerVariants,
    itemVariants
}: MusicTrackLayoutProps) {
    const metadata = item.metadata as Record<string, any> || {}

    return (
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
                className="relative z-10 flex flex-col items-center gap-8 max-w-4xl w-full"
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
                {(item.preview_url || metadata?.external_ids?.spotify) && (
                    <motion.div variants={itemVariants}>
                        {item.preview_url ? (
                            // Has preview: Show circular play button
                            <Button
                                size="lg"
                                onClick={onPlayPause}
                                className="h-20 w-20 rounded-full transition-all duration-300 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/30 hover:scale-105"
                            >
                                {isPlaying ? (
                                    <Pause className="w-8 h-8 fill-white text-white" />
                                ) : (
                                    <Play className="w-8 h-8 fill-white text-white ml-1" />
                                )}
                            </Button>
                        ) : metadata?.external_ids?.spotify ? (
                            // No preview but has Spotify: Show "Listen on Spotify" pill
                            <Button
                                asChild
                                className="px-6 py-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white font-semibold transition-all duration-300 hover:scale-105 shadow-lg shadow-green-500/20"
                            >
                                <a
                                    href={`https://open.spotify.com/track/${metadata?.external_ids?.spotify}`}
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
                        <React.Suspense fallback={<div className="h-24 animate-pulse bg-zinc-800 rounded" />}>
                            <VibeMeter features={item.audio_features} />
                        </React.Suspense>
                    </motion.div>
                )}

                {/* Technical Specs Row */}
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
                <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3 pt-4">
                    {onRefreshMetadata && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                            onClick={onRefreshMetadata}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isRefreshing && "animate-spin")} />
                            {isRefreshing ? '...' : 'Refresh'}
                        </Button>
                    )}
                    {onRegenerateDescription && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                            onClick={onRegenerateDescription}
                            disabled={isRegenerating}
                        >
                            <Wand2 className={cn("w-3.5 h-3.5 mr-1.5", isRegenerating && "animate-pulse")} />
                            {isRegenerating ? '...' : 'Regen'}
                        </Button>
                    )}

                    <Button variant="outline" size="sm" className="text-zinc-400 border-zinc-700 hover:bg-zinc-800" onClick={() => onEdit(item)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-zinc-400 border-zinc-700 hover:bg-zinc-800" onClick={onReportOpen}>
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
                className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white"
            >
                <X className="w-5 h-5" />
            </Button>
        </div>
    )
}

