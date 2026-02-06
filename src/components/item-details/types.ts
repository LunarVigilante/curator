// Types for ItemDetailView component
// Extracted from ItemDetailView.tsx for reuse across category-specific components

export interface GlobalItem {
    id: string
    title: string
    description: string | null
    description_parts: {
        premise?: string
        themes?: string
        tone?: string
        style?: string
    } | null
    image_url: string | null
    backdrop_path: string | null
    category_type: string | null
    release_year: number | null
    metadata: Record<string, any> | null
    original_title: string | null
    awards_text: string | null

    // Tags
    cached_tags: { id: string; name: string }[] | null

    // Film/TV metadata
    genres: string[] | null
    runtime: number | null
    tagline: string | null
    director: string | null
    writer: string | null
    cast: string[] | null
    studio: string | null
    networks: string[] | null
    status: string | null
    trailer_url?: string | null
    spotify_url?: string | null
    url?: string | null
    number_of_seasons: number | null
    number_of_episodes: number | null
    episodes: number | null
    original_language: string | null
    origin_countries: string[] | null
    content_rating: string | null
    budget: number | null
    box_office: number | null
    revenue: number | null
    vote_average: number | null
    vote_count: number | null
    popularity: number | null
    imdb_rating: string | null
    rotten_tomatoes_rating: string | null
    metacritic_rating: string | null
    external_ids: Record<string, string> | null

    // Cliffhanger detection (Safe Binge)
    cliffhanger_tier: 'none' | 'resolved' | 'unresolved' | 'cliffhanger' | null
    cliffhanger_score: number | null

    // Anime metadata
    romaji_title: string | null
    season: string | null
    source_material: string | null
    original_creator: string | null
    anilist_score: number | null

    // Board Game metadata
    min_players: number | null
    max_players: number | null
    min_playtime: number | null
    max_playtime: number | null
    min_age: number | null
    min_age_community: number | null
    best_players: string | null
    complexity: number | null
    mechanics: string[] | null
    categories: string[] | null
    families: string[] | null
    designers: string[] | null
    artists: string[] | null
    publishers: string[] | null
    rank_overall: number | null
    language_dependence: string | null

    // Video Game metadata
    platforms: string[] | null
    developers: string[] | null
    time_to_beat: {
        main?: number
        completionist?: number
    } | null
    game_modes: string[] | null
    keywords: string[] | null
    themes: string[] | null

    // Music metadata
    artist_names: string[] | null
    album_name: string | null
    label: string | null
    audio_features: {
        danceability?: number
        energy?: number
        valence?: number
        acousticness?: number
        tempo?: number
    } | null
    danceability?: number
    energy?: number
    valence?: number
    acousticness?: number
    tempo?: number
    preview_url: string | null
    duration_ms: number | null
    track_number: number | null
}

export interface ItemDetailViewProps {
    item: GlobalItem | null
    isOpen: boolean
    onClose: () => void
    onEdit: (item: GlobalItem) => void
    onDelete: (id: string) => void
    onItemChange?: (item: GlobalItem | null) => void
    onRefreshMetadata?: (item: GlobalItem) => Promise<void>
    onRegenerateDescription?: (item: GlobalItem) => Promise<void>
}

// Category type constants
export type CategoryType =
    | 'MOVIE'
    | 'TV'
    | 'TV_SHOW'
    | 'ANIME'
    | 'VIDEO_GAME'
    | 'BOARD_GAME'
    | 'BOOK'
    | 'MUSIC_ALBUM'
    | 'MUSIC_ARTIST'
    | 'MUSIC_TRACK'
    | 'UNKNOWN'
