'use client'

import { motion } from 'framer-motion'
import { Building, Film, Pencil, Sparkles } from 'lucide-react'
import type { GlobalItem } from '../types'
import { DetailRow } from '../shared'
import { isValidValue, formatRuntime, formatCurrency, getLanguageName, getCountryName } from '../utils'

interface MovieTvFooterProps {
    item: GlobalItem
    itemVariants: any
    isTV: boolean
}

/**
 * Movie/TV Show footer grid with Creative, Production, Format, and Run/Info columns
 */
export function MovieTvFooter({ item, itemVariants, isTV }: MovieTvFooterProps) {
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
    const sourceMaterial = metadata.source_material as string | undefined

    const director = item.director || metadata.director
    const writer = item.writer || metadata.writer
    const originalCreator = item.original_creator || metadata.original_creator
    const networks = item.networks || metadata.networks
    const numberOfSeasons = item.number_of_seasons || metadata.number_of_seasons || metadata.totalSeasons
    const numberOfEpisodes = item.number_of_episodes || metadata.number_of_episodes
    const runtime = item.runtime || metadata.runtime

    // Build air date range for TV
    const getAirDateRange = () => {
        if (!firstAirDate) return null
        const startYear = typeof firstAirDate === 'number' ? String(firstAirDate) : firstAirDate
        const endYear = lastAirDate?.slice(0, 4)

        // Ended/Canceled: show actual end year
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
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-t border-white/5 mt-4">

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
}
