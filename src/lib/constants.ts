
export const CATEGORY_TYPES = {
    MOVIE: 'MOVIE',
    TV_SHOW: 'TV_SHOW',
    BOOKS: 'BOOKS',
    VIDEO_GAME: 'VIDEO_GAME',
    BOARD_GAME: 'BOARD_GAME',
    ANIME: 'ANIME',
    MUSIC_ARTIST: 'MUSIC_ARTIST',
    ALBUM: 'ALBUM',
    PODCAST: 'PODCAST',
    COMICS: 'COMICS'
} as const

export const CATEGORY_LABELS: Record<string, string> = {
    [CATEGORY_TYPES.MOVIE]: 'Movies',
    [CATEGORY_TYPES.TV_SHOW]: 'TV Shows',
    [CATEGORY_TYPES.BOOKS]: 'Books',
    'BOOK': 'Books', // Fallback
    [CATEGORY_TYPES.VIDEO_GAME]: 'Video Games',
    [CATEGORY_TYPES.BOARD_GAME]: 'Board Games',
    [CATEGORY_TYPES.ANIME]: 'Anime',
    [CATEGORY_TYPES.MUSIC_ARTIST]: 'Artists',
    [CATEGORY_TYPES.ALBUM]: 'Albums',
    'MUSIC': 'Artists',
    [CATEGORY_TYPES.PODCAST]: 'Podcasts',
    [CATEGORY_TYPES.COMICS]: 'Comics'
}

export const DEFAULT_CATEGORIES = [
    { name: 'Movies', description: 'Cinema and films', image: '', type: CATEGORY_TYPES.MOVIE },
    { name: 'TV Shows', description: 'Television series', image: '', type: CATEGORY_TYPES.TV_SHOW },
    { name: 'Books', description: 'Reading list', image: '', type: CATEGORY_TYPES.BOOKS },
    { name: 'Video Games', description: 'Games played', image: '', type: CATEGORY_TYPES.VIDEO_GAME },
    { name: 'Board Games', description: 'Tabletop games', image: '', type: CATEGORY_TYPES.BOARD_GAME },
    { name: 'Anime', description: 'Japanese animation', image: '', type: CATEGORY_TYPES.ANIME },
    { name: 'Artists', description: 'Favorite artists', image: '', type: CATEGORY_TYPES.MUSIC_ARTIST },
    { name: 'Albums', description: 'Music albums', image: '', type: CATEGORY_TYPES.ALBUM },
    { name: 'Podcasts', description: 'Podcasts subscriptions', image: '', type: CATEGORY_TYPES.PODCAST },
    { name: 'Comics', description: 'Comics and manga', image: '', type: CATEGORY_TYPES.COMICS }
]

export function normalizeCategory(cat: string | null): string {
    if (!cat || cat.toUpperCase() === 'NULL') return 'null'
    const upper = cat.toUpperCase().replace(/\s+/g, '_')

    // Map variations to canonical keys
    if (upper === 'MOVIES' || upper === 'MOVIE') return CATEGORY_TYPES.MOVIE
    if (upper === 'TV_SHOWS' || upper === 'TV_SHOW' || upper === 'TV') return CATEGORY_TYPES.TV_SHOW
    if (upper === 'BOOKS' || upper === 'BOOK') return CATEGORY_TYPES.BOOKS
    if (upper === 'GAMES' || upper === 'GAME') return CATEGORY_TYPES.VIDEO_GAME
    if (upper === 'MUSIC') return CATEGORY_TYPES.MUSIC_ARTIST

    return upper
}

export function formatCategoryLabel(cat: string | null): string {
    if (!cat || cat === 'null' || cat === 'NULL') return 'Uncategorized'
    const validCat = CATEGORY_LABELS[cat]
    if (validCat) return validCat

    // Fallback for unknown categories
    return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
