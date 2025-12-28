/**
 * Vector Text Generator
 * 
 * Generates type-specific "Brain" text from raw API metadata for AI embeddings.
 * This string is what we embed for vector similarity search.
 * 
 * Format: Structured key-value pairs that capture the "vibe" of each media type.
 */

export type MediaType =
    | 'ANIME' | 'MANGA' | 'MOVIE' | 'TV' | 'GAME' | 'BOARD_GAME'
    | 'BOOK' | 'COMIC' | 'MUSIC_ALBUM' | 'MUSIC_ARTIST' | 'PODCAST' | 'AUDIOBOOK';

interface GeneratorInput {
    type: MediaType;
    title: string;
    metadata: Record<string, any>;
    description?: string;
}

/**
 * Strip HTML tags and clean text for embedding
 */
function cleanText(html: string | undefined | null): string {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<p>/gi, ' ')
        .replace(/<\/p>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Format array as comma-separated string
 */
function formatArray(arr: any[] | undefined, limit: number = 5): string {
    if (!arr || !Array.isArray(arr)) return '';
    return arr.slice(0, limit).join(', ');
}

/**
 * Generate vector text for ANIME
 * Key: Studio, Director, Tags (rank>60), Genres
 */
function generateAnimePayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Anime`,
        `Title: ${title}`,
        meta.studio ? `Studio: ${meta.studio}` : null,
        meta.director ? `Director: ${meta.director}` : null,
        meta.tags?.length ? `Tags: ${formatArray(meta.tags, 10)}` : null,
        meta.genres?.length ? `Genres: ${formatArray(meta.genres)}` : null,
        meta.season ? `Season: ${meta.season} ${meta.seasonYear || ''}` : null,
        meta.episodes ? `Episodes: ${meta.episodes}` : null,
        meta.format ? `Format: ${meta.format}` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 500)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for MANGA
 * Key: Author, Origin (JP/KR/CN), Tags, Genres
 */
function generateMangaPayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Manga`,
        `Title: ${title}`,
        meta.author ? `Author: ${meta.author}` : null,
        meta.countryOfOrigin ? `Origin: ${meta.countryOfOrigin}` : null,
        meta.tags?.length ? `Tags: ${formatArray(meta.tags, 10)}` : null,
        meta.genres?.length ? `Genres: ${formatArray(meta.genres)}` : null,
        meta.chapters ? `Chapters: ${meta.chapters}` : null,
        meta.volumes ? `Volumes: ${meta.volumes}` : null,
        meta.format ? `Format: ${meta.format}` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 500)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for MOVIE
 * Key: Director (crucial), Cast (top 3), Studio, Keywords
 */
function generateMoviePayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Movie`,
        `Title: ${title}`,
        meta.director ? `Director: ${meta.director}` : null,
        meta.cast?.length ? `Cast: ${formatArray(meta.cast, 3)}` : null,
        meta.productionCompanies?.length ? `Studio: ${meta.productionCompanies[0]}` : null,
        meta.keywords?.length ? `Keywords: ${formatArray(meta.keywords, 10)}` : null,
        meta.genres?.length ? `Genres: ${formatArray(meta.genres)}` : null,
        meta.runtime ? `Runtime: ${meta.runtime} minutes` : null,
        meta.collection ? `Collection: ${meta.collection}` : null,
        desc ? `Overview: ${cleanText(desc).substring(0, 500)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for TV
 * Key: Creator/Showrunner (NOT Director), Network, Country, Status
 */
function generateTvPayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: TV Show`,
        `Title: ${title}`,
        meta.creators?.length ? `Creator: ${formatArray(meta.creators, 2)}` : null,
        meta.networks?.length ? `Network: ${meta.networks[0]}` : null,
        meta.originCountry?.length ? `Country: ${meta.originCountry[0]}` : null,
        meta.status ? `Status: ${meta.status}` : null,
        meta.keywords?.length ? `Keywords: ${formatArray(meta.keywords, 10)}` : null,
        meta.genres?.length ? `Genres: ${formatArray(meta.genres)}` : null,
        meta.numberOfSeasons ? `Seasons: ${meta.numberOfSeasons}` : null,
        desc ? `Overview: ${cleanText(desc).substring(0, 500)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for GAME
 * Key: Developer (NOT Publisher), Tags (filtered), Metacritic, Platform Family
 */
function generateGamePayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Video Game`,
        `Title: ${title}`,
        meta.developers?.length ? `Developer: ${formatArray(meta.developers, 2)}` : null,
        meta.genres?.length ? `Genres: ${formatArray(meta.genres)}` : null,
        meta.tags?.length ? `Tags: ${formatArray(meta.tags, 10)}` : null,
        meta.metacritic ? `Metacritic: ${meta.metacritic}` : null,
        meta.esrbRating ? `Age Rating: ${meta.esrbRating}` : null,
        meta.parentPlatforms?.length ? `Platform Family: ${formatArray(meta.parentPlatforms)}` : null,
        meta.gameplayStyle ? `Style: ${meta.gameplayStyle}` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 500)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for BOARD_GAME
 * Key: Designer, Weight (1-5), Mechanics (crucial), Theme
 */
function generateBoardGamePayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Board Game`,
        `Title: ${title}`,
        meta.designers?.length ? `Designer: ${formatArray(meta.designers, 2)}` : null,
        meta.weight ? `Complexity: ${meta.weight}/5.0 (${meta.weightClass || 'Unknown'})` : null,
        meta.mechanics?.length ? `Mechanics: ${formatArray(meta.mechanics, 8)}` : null,
        meta.categories?.length ? `Theme: ${formatArray(meta.categories, 5)}` : null,
        meta.bestPlayerCount ? `Best Player Count: ${meta.bestPlayerCount}` : null,
        meta.playerRange ? `Players: ${meta.playerRange}` : null,
        meta.playingTime ? `Time: ${meta.playingTime} minutes` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 500)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for BOOK
 * Key: Author, Genres, Page Count
 */
function generateBookPayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Book`,
        `Title: ${title}`,
        meta.authors ? `Author: ${meta.authors}` : null,
        meta.categories?.length ? `Genres: ${formatArray(meta.categories)}` : null,
        meta.pageCount ? `Page Count: ${meta.pageCount}` : null,
        meta.lengthCategory ? `Length: ${meta.lengthCategory}` : null,
        meta.publisher ? `Publisher: ${meta.publisher}` : null,
        meta.averageRating ? `Rating: ${meta.averageRating}` : null,
        meta.language ? `Language: ${meta.language}` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 500)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for COMIC
 * Key: Series, Writer (crucial), Artist, Characters
 */
function generateComicPayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Comic Book`,
        `Title: ${title}`,
        meta.writers?.length ? `Writer: ${formatArray(meta.writers, 2)}` : null,
        meta.artists?.length ? `Artist: ${formatArray(meta.artists, 2)}` : null,
        meta.publisher ? `Publisher: ${meta.publisher}` : null,
        meta.characters?.length ? `Characters: ${formatArray(meta.characters.map((c: any) => c.name || c), 5)}` : null,
        meta.concepts?.length ? `Concepts: ${formatArray(meta.concepts.map((c: any) => c.name || c), 5)}` : null,
        meta.era ? `Era: ${meta.era}` : null,
        meta.issueCount ? `Issues: ${meta.issueCount}` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 500)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for MUSIC_ARTIST
 * Key: Genres (crucial), Popularity, Top Hits
 */
function generateMusicArtistPayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Music Artist`,
        `Artist: ${title}`,
        meta.genres?.length ? `Genres: ${formatArray(meta.genres)}` : null,
        meta.popularity ? `Popularity: ${meta.popularity}/100` : null,
        meta.topTracks?.length ? `Top Hits: ${formatArray(meta.topTracks.map((t: any) => t.name || t), 5)}` : null,
        meta.era ? `Era: ${meta.era}` : null,
        meta.followerCount ? `Followers: ${meta.followerCount}` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 300)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for MUSIC_ALBUM
 * Key: Artist, Genres, Label, Year
 */
function generateMusicAlbumPayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Music Album`,
        `Title: ${title}`,
        meta.artists ? `Artist: ${meta.artists}` : null,
        meta.genres?.length ? `Genres: ${formatArray(meta.genres)}` : null,
        meta.label ? `Label: ${meta.label}` : null,
        meta.releaseDate ? `Release: ${meta.releaseDate}` : null,
        meta.totalTracks ? `Tracks: ${meta.totalTracks}` : null,
        meta.mood ? `Mood: ${meta.mood}` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 300)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for PODCAST
 * Key: Host/Network, Primary Genre, Episode Count
 */
function generatePodcastPayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Podcast`,
        `Title: ${title}`,
        meta.artistName ? `Host/Network: ${meta.artistName}` : null,
        meta.networkVibe ? `Network Vibe: ${meta.networkVibe}` : null,
        meta.primaryGenre ? `Primary Genre: ${meta.primaryGenre}` : null,
        meta.genres?.length ? `All Genres: ${formatArray(meta.genres)}` : null,
        meta.trackCount ? `Episode Count: ${meta.trackCount}` : null,
        meta.podcastFormat ? `Format: ${meta.podcastFormat}` : null,
        meta.contentAdvisoryRating ? `Rating: ${meta.contentAdvisoryRating}` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 400)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Generate vector text for AUDIOBOOK
 * Key: Author, Narrator (crucial), Edition
 */
function generateAudiobookPayload(title: string, meta: Record<string, any>, desc?: string): string {
    const parts = [
        `Type: Audiobook`,
        `Title: ${title}`,
        meta.authors ? `Author: ${meta.authors}` : null,
        meta.narrators?.length ? `Narrator: ${formatArray(meta.narrators, 2)}` : null,
        meta.edition ? `Edition: ${meta.edition}` : null,
        meta.publisher ? `Publisher: ${meta.publisher}` : null,
        meta.isAbridged ? `Warning: Abridged` : null,
        meta.totalChapters ? `Chapters: ${meta.totalChapters}` : null,
        meta.languages?.length ? `Language: ${meta.languages[0]}` : null,
        desc ? `Description: ${cleanText(desc).substring(0, 400)}` : null,
    ];
    return parts.filter(Boolean).join('. ');
}

/**
 * Main generator function
 * Takes raw metadata and returns a type-specific vector text string
 */
export function generateVectorText(input: GeneratorInput): string {
    const { type, title, metadata, description } = input;

    switch (type) {
        case 'ANIME':
            return generateAnimePayload(title, metadata, description);
        case 'MANGA':
            return generateMangaPayload(title, metadata, description);
        case 'MOVIE':
            return generateMoviePayload(title, metadata, description);
        case 'TV':
            return generateTvPayload(title, metadata, description);
        case 'GAME':
            return generateGamePayload(title, metadata, description);
        case 'BOARD_GAME':
            return generateBoardGamePayload(title, metadata, description);
        case 'BOOK':
            return generateBookPayload(title, metadata, description);
        case 'COMIC':
            return generateComicPayload(title, metadata, description);
        case 'MUSIC_ARTIST':
            return generateMusicArtistPayload(title, metadata, description);
        case 'MUSIC_ALBUM':
            return generateMusicAlbumPayload(title, metadata, description);
        case 'PODCAST':
            return generatePodcastPayload(title, metadata, description);
        case 'AUDIOBOOK':
            return generateAudiobookPayload(title, metadata, description);
        default:
            // Fallback for unknown types
            return `Type: Unknown. Title: ${title}. ${description ? `Description: ${cleanText(description).substring(0, 500)}` : ''}`;
    }
}

/**
 * Parse metadata from JSON string if needed
 */
export function parseMetadata(metadata: string | Record<string, any> | null | undefined): Record<string, any> {
    if (!metadata) return {};
    if (typeof metadata === 'string') {
        try {
            return JSON.parse(metadata);
        } catch {
            return {};
        }
    }
    return metadata;
}

/**
 * Determine media type from category type string
 */
export function normalizeMediaType(categoryType: string | null | undefined): MediaType {
    if (!categoryType) return 'MOVIE';

    const normalized = categoryType.toUpperCase().replace(/[^A-Z_]/g, '');

    const typeMap: Record<string, MediaType> = {
        'ANIME': 'ANIME',
        'MANGA': 'MANGA',
        'MOVIE': 'MOVIE',
        'MOVIES': 'MOVIE',
        'TV': 'TV',
        'TVSHOWS': 'TV',
        'TV_SHOWS': 'TV',
        'GAME': 'GAME',
        'GAMES': 'GAME',
        'VIDEOGAMES': 'GAME',
        'VIDEO_GAMES': 'GAME',
        'BOARDGAME': 'BOARD_GAME',
        'BOARD_GAME': 'BOARD_GAME',
        'BOARDGAMES': 'BOARD_GAME',
        'BOOK': 'BOOK',
        'BOOKS': 'BOOK',
        'COMIC': 'COMIC',
        'COMICS': 'COMIC',
        'MUSIC': 'MUSIC_ALBUM',
        'MUSIC_ALBUM': 'MUSIC_ALBUM',
        'ALBUM': 'MUSIC_ALBUM',
        'ARTIST': 'MUSIC_ARTIST',
        'MUSIC_ARTIST': 'MUSIC_ARTIST',
        'PODCAST': 'PODCAST',
        'PODCASTS': 'PODCAST',
        'AUDIOBOOK': 'AUDIOBOOK',
        'AUDIOBOOKS': 'AUDIOBOOK',
    };

    return typeMap[normalized] || 'MOVIE';
}
