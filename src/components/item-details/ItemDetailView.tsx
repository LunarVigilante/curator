'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Star, Clock, Shield, Play, Users, Brain,
    Gamepad2, Tv, Film, Music, Dice5, Sparkles,
    User, Calendar, Clapperboard, Pencil, Trash2
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

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function MetaItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-400">{label}:</span>
            <span className="text-sm text-white font-medium">{value}</span>
        </div>
    )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
    if (!children) return null
    return (
        <div className="space-y-1">
            <span className="text-sm text-zinc-400">{label}</span>
            <div className="text-white font-medium">{children}</div>
        </div>
    )
}

function BadgeList({ items, limit = 5 }: { items: string[] | null; limit?: number }) {
    if (!items || items.length === 0) return null
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.slice(0, limit).map((item, i) => (
                <Badge key={i} variant="secondary" className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700">
                    {item}
                </Badge>
            ))}
            {items.length > limit && (
                <Badge variant="outline" className="text-xs text-zinc-500 border-zinc-700">
                    +{items.length - limit} more
                </Badge>
            )}
        </div>
    )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ItemDetailView({ item, onEdit, onDelete }: ItemDetailViewProps) {
    const category = normalizeCategory(item.category_type)
    const CategoryIcon = getCategoryIcon(item.category_type)

    // Extract metadata fields that might be stored in JSONB
    const meta = item.metadata || {}

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* ================================================================
                ZONE A: HERO
            ================================================================ */}
            <div className="relative rounded-xl overflow-hidden mb-6">
                {/* Background (Blurred Poster) */}
                {item.image_url && (
                    <div
                        className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30 scale-110"
                        style={{ backgroundImage: `url(${item.image_url})` }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/40" />

                {/* Content */}
                <div className="relative flex gap-6 p-6">
                    {/* Poster */}
                    {item.image_url ? (
                        <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-40 h-60 object-cover rounded-lg shadow-2xl flex-shrink-0"
                        />
                    ) : (
                        <div className="w-40 h-60 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CategoryIcon className="w-12 h-12 text-zinc-600" />
                        </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 flex flex-col justify-end">
                        {/* Category Badge */}
                        <Badge className="w-fit mb-2 bg-zinc-800/80 text-zinc-300 border-zinc-700">
                            <CategoryIcon className="w-3 h-3 mr-1" />
                            {item.category_type?.replace(/_/g, ' ') || 'Unknown'}
                        </Badge>

                        {/* Title */}
                        <h1 className="text-3xl font-bold text-white mb-1">{item.title}</h1>

                        {/* Tagline */}
                        {item.tagline && (
                            <p className="text-zinc-400 italic text-sm mb-3">"{item.tagline}"</p>
                        )}

                        {/* Year */}
                        {item.release_year && (
                            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-4">
                                <Calendar className="w-4 h-4" />
                                <span>{item.release_year}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 mt-auto">
                            {/* Watch Trailer Button */}
                            {item.trailer_url && (
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => window.open(item.trailer_url!, '_blank')}
                                >
                                    <Play className="w-4 h-4 mr-2 fill-current" />
                                    Watch Trailer
                                </Button>
                            )}

                            {onEdit && (
                                <Button variant="outline" size="sm" onClick={onEdit}>
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
            <div className="flex flex-wrap items-center gap-4 p-4 mb-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
                {/* Rating */}
                {item.vote_average && item.vote_average > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-white font-medium">{Number(item.vote_average).toFixed(1)}</span>
                        <span className="text-zinc-500 text-sm">/10</span>
                    </div>
                )}

                {/* Metacritic (Video Games) */}
                {item.metacritic && item.metacritic > 0 && (
                    <div className="flex items-center gap-1.5">
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${item.metacritic >= 75 ? 'bg-green-600 text-white' :
                                item.metacritic >= 50 ? 'bg-yellow-600 text-black' :
                                    'bg-red-600 text-white'
                            }`}>
                            {item.metacritic}
                        </div>
                        <span className="text-zinc-400 text-sm">Metacritic</span>
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

                {/* Runtime (Movies/TV) */}
                {item.runtime && item.runtime > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-white font-medium">{formatRuntime(item.runtime)}</span>
                    </div>
                )}

                {/* Episodes (Anime) */}
                {item.episodes && item.episodes > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Tv className="w-4 h-4 text-pink-400" />
                        <span className="text-white font-medium">{item.episodes}</span>
                        <span className="text-zinc-500 text-sm">episodes</span>
                    </div>
                )}

                {/* Player Count (Board Games) */}
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

                {/* Playtime (Board Games) */}
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
                        <span className="text-white font-medium">{item.content_rating}</span>
                    </div>
                )}

                {/* Separator */}
                {item.genres && item.genres.length > 0 && (
                    <>
                        <div className="h-4 w-px bg-zinc-700" />
                        <div className="flex flex-wrap gap-1.5">
                            {item.genres.slice(0, 4).map((genre, i) => (
                                <Badge key={i} variant="outline" className="text-xs text-zinc-300 border-zinc-700">
                                    {genre}
                                </Badge>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ================================================================
                ZONE C: DEEP DIVE (Category-Specific)
            ================================================================ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-zinc-900/30 rounded-lg border border-zinc-800">
                {/* Description */}
                {item.description && (
                    <div className="md:col-span-2 space-y-1">
                        <span className="text-sm text-zinc-400">Description</span>
                        <p className="text-zinc-300 leading-relaxed">{item.description}</p>
                    </div>
                )}

                {/* ============================================================
                    MOVIE / TV / ANIME
                ============================================================ */}
                {(category === 'MOVIE' || category === 'TV' || category === 'ANIME') && (
                    <>
                        {item.director && (
                            <DetailRow label="Director">{item.director}</DetailRow>
                        )}
                        {item.studio && (
                            <DetailRow label="Studio">{item.studio}</DetailRow>
                        )}
                        {item.writer && (
                            <DetailRow label="Writer">{item.writer}</DetailRow>
                        )}
                        {item.original_creator && (
                            <DetailRow label="Original Creator">{item.original_creator}</DetailRow>
                        )}
                        {item.cast && item.cast.length > 0 && (
                            <DetailRow label="Cast">
                                <BadgeList items={item.cast} limit={6} />
                            </DetailRow>
                        )}
                        {/* Anime-specific */}
                        {item.season && (
                            <DetailRow label="Season">{item.season}</DetailRow>
                        )}
                        {item.source_material && (
                            <DetailRow label="Source">{item.source_material}</DetailRow>
                        )}
                        {item.romaji_title && item.romaji_title !== item.title && (
                            <DetailRow label="Romaji Title">{item.romaji_title}</DetailRow>
                        )}
                    </>
                )}

                {/* ============================================================
                    VIDEO GAME
                ============================================================ */}
                {category === 'VIDEO_GAME' && (
                    <>
                        {item.studio && (
                            <DetailRow label="Developer">{item.studio}</DetailRow>
                        )}
                        {item.developers && item.developers.length > 0 && (
                            <DetailRow label="Developers">
                                <BadgeList items={item.developers} limit={4} />
                            </DetailRow>
                        )}
                        {item.publishers && item.publishers.length > 0 && (
                            <DetailRow label="Publishers">
                                <BadgeList items={item.publishers} limit={4} />
                            </DetailRow>
                        )}
                        {item.platforms && item.platforms.length > 0 && (
                            <DetailRow label="Platforms">
                                <BadgeList items={item.platforms} limit={6} />
                            </DetailRow>
                        )}
                        {item.playtime && item.playtime > 0 && (
                            <DetailRow label="Average Playtime">{item.playtime} hours</DetailRow>
                        )}
                    </>
                )}

                {/* ============================================================
                    BOARD GAME
                ============================================================ */}
                {category === 'BOARD_GAME' && (
                    <>
                        {item.designers && item.designers.length > 0 && (
                            <DetailRow label="Designers">
                                <BadgeList items={item.designers} limit={4} />
                            </DetailRow>
                        )}
                        {item.artists && item.artists.length > 0 && (
                            <DetailRow label="Artists">
                                <BadgeList items={item.artists} limit={4} />
                            </DetailRow>
                        )}
                        {item.publishers && item.publishers.length > 0 && (
                            <DetailRow label="Publishers">
                                <BadgeList items={item.publishers} limit={4} />
                            </DetailRow>
                        )}
                        {item.mechanics && item.mechanics.length > 0 && (
                            <DetailRow label="Mechanics">
                                <BadgeList items={item.mechanics} limit={5} />
                            </DetailRow>
                        )}
                        {item.categories && item.categories.length > 0 && (
                            <DetailRow label="Categories">
                                <BadgeList items={item.categories} limit={5} />
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

                {/* ============================================================
                    MUSIC
                ============================================================ */}
                {category === 'MUSIC' && (
                    <>
                        {meta.artist && (
                            <DetailRow label="Artist">{meta.artist}</DetailRow>
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

                {/* Tags */}
                {item.cached_tags && item.cached_tags.length > 0 && (
                    <div className="md:col-span-2 space-y-1 pt-4 border-t border-zinc-800">
                        <span className="text-sm text-zinc-400">Tags</span>
                        <div className="flex flex-wrap gap-1.5">
                            {item.cached_tags.map((tag, i) => (
                                <Badge key={tag.id || i} className="text-xs bg-cyan-900/30 text-cyan-300 border-cyan-700/50">
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
