'use client'

import { Star, Trophy, Music } from 'lucide-react'
import type { GlobalItem } from '../types'
import { normalizeCategory } from '../utils'

interface RatingBadgesProps {
    item: GlobalItem
}

/**
 * Renders rating badges appropriate for the item's category type
 * - Anime: AniList
 * - Board Games: BGG Rank, BGG Score
 * - Video Games: IGDB
 * - Movies/TV: IMDb, Rotten Tomatoes, Metacritic, TMDB
 * - Music: Spotify Popularity
 */
export function RatingBadges({ item }: RatingBadgesProps) {
    const category = normalizeCategory(item.category_type)
    const isAnime = category === 'ANIME'
    const isBoardGame = category === 'BOARD_GAME'
    const isVideoGame = category === 'VIDEO_GAME'
    const isMusicAlbum = item.category_type === 'MUSIC_ALBUM'

    // Data Fallback Strategy: Prefer top-level fields, fall back to metadata
    const metadata = item.metadata as Record<string, any> || {}
    const imdbRating = item.imdb_rating || metadata.imdb_rating
    const rtRating = item.rotten_tomatoes_rating || metadata.rotten_tomatoes_rating
    const mcRating = item.metacritic_rating || metadata.metacritic_rating

    return (
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

            {/* AniList - Priority for Anime */}
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

            {/* IMDb */}
            {imdbRating && (
                <div className="flex items-center h-7 bg-[#F5C518] text-black rounded px-2 gap-1.5 shadow-lg shadow-yellow-900/20">
                    <span className="font-black text-[10px] uppercase tracking-tighter">IMDb</span>
                    <span className="font-black text-sm">{imdbRating}</span>
                </div>
            )}

            {/* Rotten Tomatoes */}
            {rtRating && (
                <div className="flex items-center h-7 bg-[#FA320A] text-white rounded px-2 gap-1.5 shadow-lg shadow-red-900/20">
                    <span className="font-black text-[10px] uppercase tracking-tighter">RT</span>
                    <span className="font-black text-sm">{rtRating}</span>
                </div>
            )}

            {/* Metacritic */}
            {mcRating && (
                <div className="flex items-center h-7 bg-[#66CC33] text-black rounded px-2 gap-1.5 shadow-lg shadow-green-900/20">
                    <span className="font-black text-[10px] uppercase tracking-tighter">META</span>
                    <span className="font-black text-sm">{mcRating}</span>
                </div>
            )}

            {/* TMDB - Only for non-anime, non-board-game, non-video-game, non-music content */}
            {!isAnime && !isBoardGame && !isVideoGame && !isMusicAlbum && item.vote_average !== null && item.vote_average > 0 && (
                <div className="flex items-center h-7 bg-[#01B4E4] text-white rounded px-2 gap-1.5 shadow-lg shadow-sky-900/20">
                    <span className="font-black text-[10px] uppercase tracking-tighter">TMDB</span>
                    <span className="font-black text-sm">{item.vote_average.toFixed(1)}</span>
                </div>
            )}
        </div>
    )
}
