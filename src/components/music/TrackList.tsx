'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Play, Pause, Music } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Track {
    id: string
    title: string
    track_number: number | null
    duration_ms: number | null
    preview_url: string | null
    audio_features: {
        danceability?: number
        energy?: number
        valence?: number
        acousticness?: number
        tempo?: number
    } | null
}

interface TrackListProps {
    albumName: string
    artistNames: string[]
    onFeaturesLoad?: (features: Track['audio_features'][]) => void
}

// Format duration to m:ss
function formatDuration(ms: number | null): string {
    if (!ms) return '--:--'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function TrackList({ albumName, artistNames, onFeaturesLoad }: TrackListProps) {
    const [tracks, setTracks] = useState<Track[]>([])
    const [loading, setLoading] = useState(true)
    const [playingId, setPlayingId] = useState<string | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // Fetch tracks for this album
    const fetchTracks = useCallback(async () => {
        setLoading(true)
        const supabase = createClient()

        try {
            // Query tracks where album_name matches and artist overlap
            const { data, error } = await (supabase
                .from('global_items') as any)
                .select('id, title, track_number, duration_ms, preview_url, audio_features')
                .eq('category_type', 'MUSIC_TRACK')
                .eq('album_name', albumName)
                .order('track_number', { ascending: true })

            if (error) throw error

            // Filter by artist overlap if needed (relaxed for now)
            const filteredTracks = data || []
            setTracks(filteredTracks)

            // Pass features up for aggregation
            if (onFeaturesLoad && filteredTracks.length > 0) {
                const features = filteredTracks
                    .map((t: Track) => t.audio_features)
                    .filter(Boolean)
                onFeaturesLoad(features)
            }
        } catch (err) {
            console.error('Failed to fetch tracks:', err)
        } finally {
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [albumName, onFeaturesLoad])

    useEffect(() => {
        if (albumName) {
            fetchTracks()
        }
    }, [albumName, fetchTracks])

    // Handle play/pause
    const handlePlayPause = (track: Track) => {
        if (!track.preview_url) return

        if (playingId === track.id) {
            // Pause current
            audioRef.current?.pause()
            setPlayingId(null)
        } else {
            // Play new track
            if (audioRef.current) {
                audioRef.current.pause()
            }
            const audio = new Audio(track.preview_url)
            audio.volume = 0.5
            audio.play()
            audio.onended = () => setPlayingId(null)
            audioRef.current = audio
            setPlayingId(track.id)
        }
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            audioRef.current?.pause()
        }
    }, [])

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
                <Music className="w-4 h-4 animate-pulse" />
                <span>Loading tracks...</span>
            </div>
        )
    }

    if (tracks.length === 0) {
        return (
            <div className="text-zinc-500 text-sm py-4 text-center">
                No tracks found for this album
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Music className="w-4 h-4" />
                Tracklist ({tracks.length})
            </h3>

            <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                    {tracks.map((track, index) => (
                        <div
                            key={track.id}
                            className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${playingId === track.id
                                ? 'bg-purple-500/10 text-purple-300'
                                : 'hover:bg-zinc-800/50'
                                }`}
                        >
                            {/* Track Number */}
                            <span className="w-6 text-xs text-zinc-500 text-right tabular-nums">
                                {track.track_number || index + 1}
                            </span>

                            {/* Play Button */}
                            {track.preview_url ? (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-zinc-400 hover:text-white"
                                    onClick={() => handlePlayPause(track)}
                                    aria-label={playingId === track.id ? `Pause ${track.title}` : `Play ${track.title}`}
                                >
                                    {playingId === track.id ? (
                                        <Pause className="w-3.5 h-3.5 fill-current" />
                                    ) : (
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                    )}
                                </Button>
                            ) : (
                                <div className="h-7 w-7 shrink-0" />
                            )}

                            {/* Title */}
                            <span className="flex-1 text-sm text-zinc-200 truncate">
                                {track.title}
                            </span>

                            {/* Duration */}
                            <span className="text-xs text-zinc-500 tabular-nums">
                                {formatDuration(track.duration_ms)}
                            </span>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}
