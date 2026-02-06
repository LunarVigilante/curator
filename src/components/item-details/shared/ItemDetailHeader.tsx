'use client'

import React from 'react'
import type { GlobalItem } from '../types'
import { getCategoryIcon, cleanTitle, normalizeCategory } from '../utils'
import { RatingBadges } from './RatingBadges'
import Link from 'next/link'
import { Film, Clapperboard } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ItemDetailHeaderProps {
    item: GlobalItem
}

// Static component for rendering category icon - avoids dynamic component creation during render
function CategoryIconDisplay({ categoryType }: { categoryType: string | null }) {
    const Icon = getCategoryIcon(categoryType)
    // eslint-disable-next-line react-hooks/static-components
    return Icon ? <Icon className="w-3.5 h-3.5 mb-0.5" /> : null
}

export function ItemDetailHeader({ item }: ItemDetailHeaderProps) {
    const category = normalizeCategory(item.category_type)
    const isTV = category === 'TV' || category === 'TV_SHOW'
    const isMovie = category === 'MOVIE'
    const metadata = item.metadata as Record<string, any> || {}
    const imdbRating = item.imdb_rating || metadata.imdb_rating
    const rtRating = item.rotten_tomatoes_rating || metadata.rotten_tomatoes_rating

    // Build year range for TV shows
    const getYearRange = () => {
        if (!item.release_year) return null
        const metadata = item.metadata as Record<string, unknown> || {}
        const lastAirDate = metadata.last_air_date as string | undefined
        const endYear = lastAirDate?.slice(0, 4)
        const statusLower = item.status?.toLowerCase() || ''
        const isEnded = statusLower.includes('ended') || statusLower.includes('canceled')

        if (isEnded && endYear && String(item.release_year) !== endYear) {
            return `${item.release_year}–${endYear}`
        }
        if (!isEnded) {
            return `${item.release_year}–Present`
        }
        return String(item.release_year)
    }

    return (
        <div className="space-y-4">
            {/* Category • Year • Rating */}
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                <CategoryIconDisplay categoryType={item.category_type} />
                <span>{item.category_type?.replace('_', ' ')}</span>
                <span className="text-zinc-800">•</span>
                <span>{item.release_year}</span>
                {item.content_rating && (
                    <>
                        <span className="text-zinc-800">•</span>
                        <span className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800/50 text-zinc-400">
                            {item.content_rating}
                        </span>
                    </>
                )}
            </div>

            {/* Title */}
            <div>
                <h2 className="text-4xl md:text-5xl font-black text-white leading-[0.95] tracking-tight drop-shadow-lg">
                    {cleanTitle(item.title)}
                </h2>
                {item.original_title && item.original_title !== item.title && (
                    <p className="text-zinc-500 text-lg mt-1 font-medium">{item.original_title}</p>
                )}
                {item.romaji_title && (
                    <p className="text-zinc-500 text-lg mt-1 font-medium italic">{item.romaji_title}</p>
                )}

                {/* Artist Name for Albums */}
                {item.artist_names && item.artist_names.length > 0 && (
                    <p className="text-2xl text-zinc-400 mt-2 flex items-center gap-2">
                        <span className="text-zinc-600">by</span>
                        <span className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors cursor-pointer">
                            {item.artist_names[0]}
                        </span>
                    </p>
                )}
            </div>

            {/* Binge Metrics Row - TV Shows Only */}
            {isTV && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
                    {(item.number_of_seasons ?? 0) > 0 && (
                        <span className="font-medium text-white">
                            {item.number_of_seasons} {item.number_of_seasons === 1 ? 'Season' : 'Seasons'}
                        </span>
                    )}
                    {(item.number_of_seasons ?? 0) > 0 && (item.episodes ?? item.number_of_episodes ?? 0) > 0 && (
                        <span className="text-zinc-600">•</span>
                    )}
                    {(item.episodes ?? item.number_of_episodes ?? 0) > 0 && (
                        <span className="font-medium text-white">
                            {item.episodes ?? item.number_of_episodes} Episodes
                        </span>
                    )}
                    {getYearRange() && (
                        <>
                            <span className="text-zinc-600">•</span>
                            <span>{getYearRange()}</span>
                        </>
                    )}
                    {item.networks && item.networks.length > 0 && (
                        <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-blue-400">{item.networks[0]}</span>
                        </>
                    )}
                </div>
            )}

            {/* Tagline - Serif font, no border */}
            {item.tagline && (
                <p className="text-xl text-zinc-400 font-light italic font-serif py-1">
                    &ldquo;{item.tagline}&rdquo;
                </p>
            )}

            {/* Links Row (TV/Movie) */}
            {(isTV || isMovie) ? (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                    {/* TMDB Button */}
                    {item.vote_average !== null && item.vote_average > 0 && item.external_ids?.tmdb && (
                        <Button asChild size="sm" className="h-6 px-2 gap-1.5 bg-[#01B4E4] hover:bg-[#018AB0] text-white font-black border-0 rounded transition-transform hover:scale-105">
                            <Link href={`https://www.themoviedb.org/${isTV ? 'tv' : 'movie'}/${item.external_ids.tmdb}`} target="_blank">
                                <span className="text-[10px] uppercase tracking-tighter opacity-80">TMDB</span>
                                <span className="text-sm">{item.vote_average.toFixed(1)}</span>
                            </Link>
                        </Button>
                    )}

                    {/* IMDb Button */}
                    {imdbRating && item.external_ids?.imdb && (
                        <Button asChild size="sm" className="h-6 px-2 gap-1.5 bg-[#F5C518] hover:bg-[#C49A13] text-black hover:text-white font-black border-0 rounded transition-transform hover:scale-105">
                            <Link href={`https://www.imdb.com/title/${item.external_ids.imdb}`} target="_blank">
                                <span className="text-[10px] uppercase tracking-tighter opacity-80">IMDb</span>
                                <span className="text-sm">{imdbRating}</span>
                            </Link>
                        </Button>
                    )}

                    {/* RT Button */}
                    {rtRating && (
                        <Button asChild size="sm" className="h-6 px-2 gap-1.5 bg-[#FA320A] hover:bg-[#C02808] text-white font-black border-0 rounded transition-transform hover:scale-105">
                            <Link href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(item.title)}`} target="_blank">
                                <span className="text-[10px] uppercase tracking-tighter opacity-80">RT</span>
                                <span className="text-sm">{rtRating}</span>
                            </Link>
                        </Button>
                    )}
                </div>
            ) : (
                <RatingBadges item={item} />
            )}
        </div>
    )
}

