'use client'

import { motion } from 'framer-motion'
import { Building, Film, Pencil, Sparkles, Brain, Shield, CheckCircle, AlertTriangle, Circle } from 'lucide-react'
import type { GlobalItem } from '../types'
import { DetailRow } from '../shared'
import { isValidValue, formatRuntime, formatCurrency, getLanguageName, getCountryName } from '../utils'

interface MovieTvFooterProps {
    item: GlobalItem
    itemVariants: any
    isTV: boolean
}

// Story Status badge colors based on cliffhanger tier
const STORY_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    'none': { label: 'Complete Story', color: 'text-emerald-400', icon: CheckCircle },
    'resolved': { label: 'Resolved Finale', color: 'text-emerald-400', icon: CheckCircle },
    'unresolved': { label: 'Open-Ended', color: 'text-amber-400', icon: AlertTriangle },
    'cliffhanger': { label: 'Major Cliffhanger', color: 'text-red-400', icon: AlertTriangle },
}

/**
 * Movie/TV Show footer grid with Creative/Insights, Production, Format, and Run/Info columns
 * 
 * Key Features:
 * - INSIGHTS column replaces empty Creative column (shows Narrative Engine, Archetypes)
 * - Safe Binge badge anchors the Run column for visual balance
 * - Production studio fallback when no creator data
 * - Dynamic grid that always maintains 4 columns
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
    const spokenLanguages = item.metadata?.spoken_languages as string[] | undefined

    const director = item.director || metadata.director
    const writer = item.writer || metadata.writer
    const originalCreator = item.original_creator || metadata.original_creator
    const networks = item.networks || metadata.networks
    const productionCompanies = item.metadata?.production_companies as string[] | undefined
    const numberOfSeasons = item.number_of_seasons || metadata.number_of_seasons || metadata.totalSeasons
    const numberOfEpisodes = item.number_of_episodes || metadata.number_of_episodes
    const runtime = item.runtime || metadata.runtime

    // Check if Creative column has any data
    const hasCreativeData = isTV
        ? !!(createdBy?.length || isValidValue(director) || isValidValue(writer) || isValidValue(sourceMaterial) || isValidValue(originalCreator))
        : !!(isValidValue(director) || isValidValue(writer) || isValidValue(sourceMaterial))

    // Extract semantic insights for fallback column
    const narrativeEngine = metadata.save_the_cat || metadata.narrative_engine
    const archetype = metadata.archetype || (item.keywords?.find((k: string) =>
        k.toLowerCase().includes('archetype') ||
        k.toLowerCase().includes('gladiator') ||
        k.toLowerCase().includes('fool') ||
        k.toLowerCase().includes('trickster')
    ))
    const coreTrope = metadata.core_trope || (item.keywords?.find((k: string) =>
        k.toLowerCase().includes('trope') ||
        k.toLowerCase().includes('experiment') ||
        k.toLowerCase().includes('competition')
    ))

    // Check if we have insights to show as fallback
    const hasInsightsData = !!(narrativeEngine || archetype || coreTrope || item.cliffhanger_tier)

    // Get cliffhanger status config
    const storyStatus = item.cliffhanger_tier ? STORY_STATUS_CONFIG[item.cliffhanger_tier] : null

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

    return (
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-t border-white/5">

            {/* BLOCK 1: CREATIVE or INSIGHTS (fallback) */}
            {hasCreativeData ? (
                // === CREATIVE COLUMN (has creator data) ===
                <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Pencil className="w-3 h-3" /> Creative
                    </h5>
                    <div className="space-y-0.5">
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
                                {isValidValue(writer) && <DetailRow label="Writer"><span className="text-zinc-300">{writer}</span></DetailRow>}
                                {isValidValue(sourceMaterial) && (
                                    <DetailRow label="Based On"><span className="text-zinc-400 italic">{sourceMaterial}</span></DetailRow>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ) : (
                // === INSIGHTS COLUMN (fallback when no creative data) ===
                <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Brain className="w-3 h-3" /> Insights
                    </h5>
                    <div className="space-y-0.5">
                        {narrativeEngine && (
                            <DetailRow label="Narrative"><span className="text-purple-300">{narrativeEngine}</span></DetailRow>
                        )}
                        {archetype && (
                            <DetailRow label="Archetype"><span className="text-cyan-300">{archetype}</span></DetailRow>
                        )}
                        {coreTrope && (
                            <DetailRow label="Core Trope"><span className="text-amber-300">{coreTrope}</span></DetailRow>
                        )}
                        {!hasInsightsData && item.studio && (
                            // Ultimate fallback: show production studio in Insights
                            <DetailRow label="Developed By"><span className="text-zinc-400">{item.studio}</span></DetailRow>
                        )}
                        {!hasInsightsData && !item.studio && productionCompanies?.[0] && (
                            <DetailRow label="Format By"><span className="text-zinc-400">{productionCompanies[0]}</span></DetailRow>
                        )}
                    </div>
                </div>
            )}

            {/* BLOCK 2: PRODUCTION */}
            <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5"><Building className="w-3 h-3" /> Production</h5>
                <div className="space-y-0.5">
                    {isTV && networks && networks.length > 0 && (
                        <DetailRow label="Network"><span className="text-white font-medium">{networks[0]}</span></DetailRow>
                    )}
                    <DetailRow label="Studio">
                        <span className={isTV ? "text-zinc-400" : "text-white font-medium"}>{item.studio || '--'}</span>
                    </DetailRow>
                    {productionCompanies && productionCompanies.length > 1 && (
                        <DetailRow label="Also"><span className="text-zinc-500 text-xs">{productionCompanies.slice(1, 3).join(', ')}</span></DetailRow>
                    )}
                    {item.content_rating && (
                        <DetailRow label="Rated"><span className="text-zinc-300">{item.content_rating}</span></DetailRow>
                    )}
                </div>
            </div>

            {/* BLOCK 3: FORMAT */}
            <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5"><Film className="w-3 h-3" /> Format</h5>
                <div className="space-y-0.5">
                    {isTV ? (
                        <>
                            {numberOfSeasons && numberOfSeasons > 0 && <DetailRow label="Seasons"><span className="text-white">{numberOfSeasons}</span></DetailRow>}
                            {((item.episodes && item.episodes > 0) || (numberOfEpisodes && numberOfEpisodes > 0)) && (
                                <DetailRow label="Episodes"><span className="text-white">{item.episodes || numberOfEpisodes}</span></DetailRow>
                            )}
                            {avgRuntime && <DetailRow label="Episode Runtime"><span className="text-zinc-400">{avgRuntime}</span></DetailRow>}
                        </>
                    ) : (
                        <>
                            <DetailRow label="Runtime">
                                <span className="text-white">{runtime ? formatRuntime(runtime) : '-- min'}</span>
                            </DetailRow>
                            {formatCurrency(item.budget) && <DetailRow label="Budget"><span className="text-zinc-400">{formatCurrency(item.budget)}</span></DetailRow>}
                            {(formatCurrency(item.revenue) || formatCurrency((item.metadata as Record<string, any>)?.revenue)) && (
                                <DetailRow label="Revenue"><span className="text-green-400">{formatCurrency(item.revenue) || formatCurrency((item.metadata as Record<string, any>)?.revenue)}</span></DetailRow>
                            )}
                            {formatCurrency(item.box_office) && <DetailRow label="Box Office"><span className="text-zinc-400">{formatCurrency(item.box_office)}</span></DetailRow>}
                        </>
                    )}
                </div>
            </div>

            {/* BLOCK 4: RUN / INFO with Safe Binge Anchor */}
            <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> {isTV ? 'Run' : 'Info'}
                </h5>
                <div className="space-y-0.5">
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
                            {isValidValue(item.status) && <DetailRow label="Status"><span className="text-zinc-400">{item.status}</span></DetailRow>}
                            {getLanguageName(item.original_language) && <DetailRow label="Language"><span className="text-zinc-400">{getLanguageName(item.original_language)}</span></DetailRow>}

                            {/* === SAFE BINGE ANCHOR === */}
                            {storyStatus && isEnded && (
                                <div className="pt-2 mt-2 border-t border-white/5">
                                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${storyStatus.color}`}>
                                        <Shield className="w-3.5 h-3.5" />
                                        <span>{storyStatus.label}</span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {isValidValue(item.status) && <DetailRow label="Status"><span className="text-zinc-400">{item.status}</span></DetailRow>}
                            {getLanguageName(item.original_language) && <DetailRow label="Language"><span className="text-zinc-300">{getLanguageName(item.original_language)}</span></DetailRow>}
                            {item.origin_countries && item.origin_countries.length > 0 && getCountryName(item.origin_countries[0]) && (
                                <DetailRow label="Country"><span className="text-zinc-300">{getCountryName(item.origin_countries[0])}</span></DetailRow>
                            )}
                            {spokenLanguages && spokenLanguages.length > 1 && (
                                <DetailRow label="Languages"><span className="text-zinc-500 text-xs">{spokenLanguages.slice(0, 3).join(', ')}</span></DetailRow>
                            )}
                        </>
                    )}
                </div>
            </div>

        </motion.div>
    )
}

