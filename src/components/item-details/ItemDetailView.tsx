'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FilterPill, FilterPillList } from '@/components/ui/FilterPill'
import {
    Star, Clock, Shield, Play, Users, Brain,
    Gamepad2, Tv, Film, Music, Dice5, Sparkles,
    Calendar, Pencil, Trash2
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface GlobalItem {
    id: string
    title: string
    description: string | null
    image_url: string | null
    category_type: string | null
    release_year: number | null
    metadata: Record<string, any> | null
    cached_tags: { id: string; name: string }[] | null

    // Media
    cast: string[] | null
    director: string | null
    writer: string | null
    studio: string | null
    genres: string[] | null
    content_rating: string | null
    runtime: number | null
    vote_average: number | null
    trailer_url: string | null
    tagline: string | null

    // Anime
    episodes: number | null
    season: string | null
    source_material: string | null
    romaji_title: string | null
    original_creator: string | null

    // Gaming (Video Games)
    platforms: string[] | null
    developers: string[] | null
    publishers: string[] | null
    playtime: number | null
    metacritic: number | null

    // Board Games
    min_players: number | null
    max_players: number | null
    min_playtime: number | null
    max_playtime: number | null
    min_age: number | null
    mechanics: string[] | null
    categories: string[] | null
    complexity: number | null
    designers: string[] | null
    artists: string[] | null
    is_expansion: boolean | null
    bgg_id: number | null
}

interface ItemDetailViewProps {
    item: GlobalItem
    onEdit?: () => void
    onDelete?: () => void
}

// ============================================================================
// HELPERS
// ============================================================================

function formatRuntime(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
}

function getCategoryIcon(category: string | null) {
    const cat = category?.toUpperCase() || ''
    if (cat.includes('MOVIE')) return Film
    if (cat.includes('TV')) return Tv
    if (cat.includes('ANIME')) return Sparkles
    if (cat.includes('VIDEO') || cat.includes('GAME') && !cat.includes('BOARD')) return Gamepad2
    if (cat.includes('BOARD')) return Dice5
    if (cat.includes('MUSIC') || cat.includes('ALBUM')) return Music
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

function getCategorySlug(category: string | null): string {
    const normalized = normalizeCategory(category)
    return normalized.toLowerCase().replace(/_/g, '-')
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
    if (!children) return null
    return (
        <div className="space-y-1.5">
            <span className="text-sm text-zinc-400 uppercase tracking-wider">{label}</span>
            <div className="text-white font-medium">{children}</div>
        </div>
    )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ItemDetailView({ item, onEdit, onDelete }: ItemDetailViewProps) {
    const category = normalizeCategory(item.category_type)
    const categorySlug = getCategorySlug(item.category_type)
    const CategoryIcon = getCategoryIcon(item.category_type)
    const meta = item.metadata || {}

    return (
        <div className="w-full max-w-4xl mx-auto bg-zinc-950 rounded-xl">
            {/* ================================================================
                ZONE A: HERO
            ================================================================ */}
            <div className="relative rounded-t-xl overflow-hidden">
                {/* Background (Blurred Poster) */}
                {item.image_url && (
                    <div
                        className="absolute inset-0 bg-cover bg-center blur-2xl opacity-25 scale-110"
                        style={{ backgroundImage: `url(${item.image_url})` }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-zinc-950/60" />

                {/* Content */}
                <div className="relative flex gap-6 p-6">
                    {/* Poster */}
                    {item.image_url ? (
                        <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-36 h-52 object-cover rounded-lg shadow-2xl flex-shrink-0 border border-zinc-800"
                        />
                    ) : (
                        <div className="w-36 h-52 bg-zinc-900 rounded-lg flex items-center justify-center flex-shrink-0 border border-zinc-800">
                            <CategoryIcon className="w-12 h-12 text-zinc-700" />
                        </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 flex flex-col justify-end min-w-0">
                        {/* Category Badge */}
                        <Badge className="w-fit mb-2 bg-zinc-900 text-zinc-400 border-zinc-800">
                            <CategoryIcon className="w-3 h-3 mr-1" />
                            {item.category_type?.replace(/_/g, ' ') || 'Unknown'}
                        </Badge>

                        {/* Title */}
                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 truncate">{item.title}</h1>

                        {/* Tagline */}
                        {item.tagline && (
                            <p className="text-zinc-500 italic text-sm mb-2 line-clamp-2">"{item.tagline}"</p>
                        )}

                        {/* Year */}
                        {item.release_year && (
                            <div className="flex items-center gap-2 text-zinc-500 text-sm mb-4">
                                <Calendar className="w-4 h-4" />
                                <span>{item.release_year}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 mt-auto">
                            {item.trailer_url && (
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    size="sm"
                                    onClick={() => window.open(item.trailer_url!, '_blank')}
                                >
                                    <Play className="w-4 h-4 mr-2 fill-current" />
                                    Watch Trailer
                                </Button>
                            )}

                            {onEdit && (
                                <Button variant="outline" size="sm" onClick={onEdit} className="border-zinc-700 hover:bg-zinc-800">
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit
                                </Button>
                            )}

                            {onDelete && (
                                <Button variant="destructive" size="sm" onClick={onDelete}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================
                ZONE B: META-BAR
            ================================================================ */}
            <div className="flex flex-wrap items-center gap-4 px-6 py-4 bg-zinc-900/80 border-y border-zinc-800">
                {/* Rating */}
                {item.vote_average && item.vote_average > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-white font-medium">{Number(item.vote_average).toFixed(1)}</span>
                        <span className="text-zinc-500 text-sm">/10</span>
                    </div>
                )}

                {/* Metacritic */}
                {item.metacritic && item.metacritic > 0 && (
                    <div className="flex items-center gap-1.5">
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${item.metacritic >= 75 ? 'bg-green-600 text-white' :
                                item.metacritic >= 50 ? 'bg-yellow-600 text-black' :
                                    'bg-red-600 text-white'
                            }`}>
                            {item.metacritic}
                        </div>
                        <span className="text-zinc-500 text-sm">Metacritic</span>
                    </div>
                )}

                {/* Complexity (Board Games) */}
                {item.complexity && item.complexity > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-purple-400" />
                        <span className="text-white font-medium">{Number(item.complexity).toFixed(2)}</span>
                        <span className="text-zinc-500 text-sm">/5</span>
                    </div>
                )}

                {/* Runtime */}
                {item.runtime && item.runtime > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-white font-medium">{formatRuntime(item.runtime)}</span>
                    </div>
                )}

                {/* Episodes */}
                {item.episodes && item.episodes > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Tv className="w-4 h-4 text-pink-400" />
                        <span className="text-white font-medium">{item.episodes}</span>
                        <span className="text-zinc-500 text-sm">episodes</span>
                    </div>
                )}

                {/* Player Count */}
                {(item.min_players || item.max_players) && (
                    <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-green-400" />
                        <span className="text-white font-medium">
                            {item.min_players === item.max_players
                                ? item.min_players
                                : `${item.min_players || '?'}-${item.max_players || '?'}`}
                        </span>
                        <span className="text-zinc-500 text-sm">players</span>
                    </div>
                )}

                {/* Board Game Playtime */}
                {(item.min_playtime || item.max_playtime) && (
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <span className="text-white font-medium">
                            {item.min_playtime === item.max_playtime
                                ? `${item.min_playtime}m`
                                : `${item.min_playtime || '?'}-${item.max_playtime || '?'}m`}
                        </span>
                    </div>
                )}

                {/* Content Rating */}
                {item.content_rating && (
                    <div className="flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-zinc-400" />
                        <FilterPill label={item.content_rating} type="content_rating" category={categorySlug} />
                    </div>
                )}

                {/* Genres (Clickable) */}
                {item.genres && item.genres.length > 0 && (
                    <>
                        <div className="h-4 w-px bg-zinc-700" />
                        <FilterPillList items={item.genres} type="genre" category={categorySlug} limit={4} />
                    </>
                )}
            </div>

            {/* ================================================================
                ZONE C: DEEP DIVE
            ================================================================ */}
            <div className="p-6 space-y-6">
                {/* Description */}
                {item.description && (
                    <div className="space-y-2">
                        <span className="text-sm text-zinc-400 uppercase tracking-wider">Description</span>
                        <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{item.description}</p>
                    </div>
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* MOVIE / TV / ANIME */}
                    {(category === 'MOVIE' || category === 'TV' || category === 'ANIME') && (
                        <>
                            {item.director && (
                                <DetailRow label="Director">
                                    <FilterPill label={item.director} type="director" category={categorySlug} />
                                </DetailRow>
                            )}
                            {item.studio && (
                                <DetailRow label="Studio">
                                    <FilterPill label={item.studio} type="studio" category={categorySlug} />
                                </DetailRow>
                            )}
                            {item.writer && (
                                <DetailRow label="Writer">{item.writer}</DetailRow>
                            )}
                            {item.original_creator && (
                                <DetailRow label="Original Creator">{item.original_creator}</DetailRow>
                            )}
                            {item.cast && item.cast.length > 0 && (
                                <DetailRow label="Cast">
                                    <FilterPillList items={item.cast} type="cast" category={categorySlug} limit={6} />
                                </DetailRow>
                            )}
                            {item.season && <DetailRow label="Season">{item.season}</DetailRow>}
                            {item.source_material && <DetailRow label="Source">{item.source_material}</DetailRow>}
                            {item.romaji_title && item.romaji_title !== item.title && (
                                <DetailRow label="Romaji Title">{item.romaji_title}</DetailRow>
                            )}
                        </>
                    )}

                    {/* VIDEO GAME */}
                    {category === 'VIDEO_GAME' && (
                        <>
                            {item.studio && (
                                <DetailRow label="Developer">
                                    <FilterPill label={item.studio} type="developer" category={categorySlug} />
                                </DetailRow>
                            )}
                            {item.developers && item.developers.length > 0 && (
                                <DetailRow label="Developers">
                                    <FilterPillList items={item.developers} type="developer" category={categorySlug} limit={4} />
                                </DetailRow>
                            )}
                            {item.publishers && item.publishers.length > 0 && (
                                <DetailRow label="Publishers">
                                    <FilterPillList items={item.publishers} type="studio" category={categorySlug} limit={4} />
                                </DetailRow>
                            )}
                            {item.platforms && item.platforms.length > 0 && (
                                <DetailRow label="Platforms">
                                    <FilterPillList items={item.platforms} type="platform" category={categorySlug} limit={6} />
                                </DetailRow>
                            )}
                            {item.playtime && item.playtime > 0 && (
                                <DetailRow label="Average Playtime">{item.playtime} hours</DetailRow>
                            )}
                        </>
                    )}

                    {/* BOARD GAME */}
                    {category === 'BOARD_GAME' && (
                        <>
                            {item.designers && item.designers.length > 0 && (
                                <DetailRow label="Designers">
                                    <FilterPillList items={item.designers} type="designer" category={categorySlug} limit={4} />
                                </DetailRow>
                            )}
                            {item.artists && item.artists.length > 0 && (
                                <DetailRow label="Artists">
                                    <FilterPillList items={item.artists} type="artist" category={categorySlug} limit={4} />
                                </DetailRow>
                            )}
                            {item.publishers && item.publishers.length > 0 && (
                                <DetailRow label="Publishers">
                                    <FilterPillList items={item.publishers} type="studio" category={categorySlug} limit={4} />
                                </DetailRow>
                            )}
                            {item.mechanics && item.mechanics.length > 0 && (
                                <DetailRow label="Mechanics">
                                    <FilterPillList items={item.mechanics} type="mechanic" category={categorySlug} limit={5} />
                                </DetailRow>
                            )}
                            {item.categories && item.categories.length > 0 && (
                                <DetailRow label="Categories">
                                    <FilterPillList items={item.categories} type="genre" category={categorySlug} limit={5} />
                                </DetailRow>
                            )}
                            {item.min_age && item.min_age > 0 && (
                                <DetailRow label="Minimum Age">{item.min_age}+</DetailRow>
                            )}
                            {item.is_expansion && (
                                <DetailRow label="Type">
                                    <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30">Expansion</Badge>
                                </DetailRow>
                            )}
                        </>
                    )}

                    {/* MUSIC */}
                    {category === 'MUSIC' && (
                        <>
                            {meta.artist && (
                                <DetailRow label="Artist">
                                    <FilterPill label={meta.artist} type="cast" category={categorySlug} />
                                </DetailRow>
                            )}
                            {meta.total_tracks && (
                                <DetailRow label="Tracks">{meta.total_tracks} tracks</DetailRow>
                            )}
                            {meta.release_date && (
                                <DetailRow label="Release Date">{meta.release_date}</DetailRow>
                            )}
                            {meta.spotify_url && (
                                <DetailRow label="Listen">
                                    <a
                                        href={meta.spotify_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-400 hover:text-green-300 underline"
                                    >
                                        Open in Spotify
                                    </a>
                                </DetailRow>
                            )}
                        </>
                    )}
                </div>

                {/* Tags (Clickable) */}
                {item.cached_tags && item.cached_tags.length > 0 && (
                    <div className="pt-4 border-t border-zinc-800 space-y-2">
                        <span className="text-sm text-zinc-400 uppercase tracking-wider">Tags</span>
                        <div className="flex flex-wrap gap-1.5">
                            {item.cached_tags.map((tag, i) => (
                                <FilterPill
                                    key={tag.id || i}
                                    label={tag.name}
                                    type="tag"
                                    category={categorySlug}
                                    className="bg-cyan-900/30 text-cyan-300 border-cyan-700/50 hover:bg-cyan-800/50"
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
