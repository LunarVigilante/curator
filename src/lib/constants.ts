
export const CATEGORY_TYPES = {
    MOVIE: 'MOVIE',
    TV_SHOW: 'TV_SHOW',
    BOOKS: 'BOOKS',
    VIDEO_GAME: 'VIDEO_GAME',
    BOARD_GAME: 'BOARD_GAME',
    ANIME: 'ANIME',
    MUSIC_ARTIST: 'MUSIC_ARTIST',
    ALBUM: 'ALBUM',
    MUSIC_TRACK: 'MUSIC_TRACK',
    PODCAST: 'PODCAST',
    COMICS: 'COMICS',
    MANGA: 'MANGA',
    LIGHT_NOVEL: 'LIGHT_NOVEL'
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
    [CATEGORY_TYPES.MUSIC_TRACK]: 'Tracks',
    'MUSIC': 'Artists',
    [CATEGORY_TYPES.PODCAST]: 'Podcasts',
    [CATEGORY_TYPES.COMICS]: 'Comics',
    [CATEGORY_TYPES.MANGA]: 'Manga',
    [CATEGORY_TYPES.LIGHT_NOVEL]: 'Light Novels'
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
    { name: 'Tracks', description: 'Individual songs', image: '', type: CATEGORY_TYPES.MUSIC_TRACK },
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
    if (upper === 'TRACKS' || upper === 'TRACK' || upper === 'SONGS') return CATEGORY_TYPES.MUSIC_TRACK

    return upper
}

export function formatCategoryLabel(cat: string | null): string {
    if (!cat || cat === 'null' || cat === 'NULL') return 'Uncategorized'
    const validCat = CATEGORY_LABELS[cat]
    if (validCat) return validCat

    // Fallback for unknown categories
    return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
