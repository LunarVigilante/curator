import { MediaStrategy, MediaSearchResponse } from "./types";
import { AniListStrategy } from "./strategies/AniListStrategy";
import { TmdbStrategy } from "./strategies/TmdbStrategy";
import { RawgStrategy } from "./strategies/RawgStrategy";
import { GoogleBooksStrategy } from "./strategies/GoogleBooksStrategy";
import { ItunesPodcastStrategy } from "./strategies/ItunesPodcastStrategy";
import { SpotifyStrategy } from "./strategies/SpotifyStrategy";
import { SpotifyAudiobooksStrategy } from "./strategies/SpotifyAudiobooksStrategy";
import { BggStrategy } from "./strategies/BggStrategy";
import { ComicVineStrategy } from "./strategies/ComicVineStrategy";
import { SystemSettings } from "@/lib/services/SystemConfigService";

/**
 * Strategy Registry Pattern for Media Service.
 * 
 * Maps media type keywords to their corresponding strategies.
 * This pattern allows:
 * 1. Easy addition of new strategies without modifying routing logic
 * 2. Clear, maintainable keyword-to-strategy mappings
 * 3. Consistent resolution logic
 */
export class MediaService {
    /** Default strategy when no match is found */
    private defaultStrategy: MediaStrategy;

    /** 
     * Registry mapping keywords to strategies.
     * Keys are lowercase for case-insensitive matching.
     */
    private strategyRegistry: Map<string, MediaStrategy> = new Map();

    constructor() {
        // Instantiate all strategies
        const aniListAnimeStrategy = new AniListStrategy('ANIME');
        const aniListMangaStrategy = new AniListStrategy('MANGA');
        const tmdbStrategy = new TmdbStrategy();
        const rawgStrategy = new RawgStrategy();
        const googleBooksStrategy = new GoogleBooksStrategy();
        const itunesPodcastStrategy = new ItunesPodcastStrategy();
        const spotifyStrategy = new SpotifyStrategy();
        const spotifyAudiobooksStrategy = new SpotifyAudiobooksStrategy();
        const bggStrategy = new BggStrategy();

        // Set default strategy (TMDB is most versatile)
        this.defaultStrategy = tmdbStrategy;

        // Register strategies with their associated keywords
        // Anime -> AniList (ANIME type)
        this.registerStrategy(aniListAnimeStrategy, ['anime', 'animation', 'japanese_anime']);

        // Manga -> AniList (MANGA type)
        this.registerStrategy(aniListMangaStrategy, ['manga', 'manhwa', 'manhua', 'webtoon']);

        // Movies/TV -> TMDB  
        this.registerStrategy(tmdbStrategy, ['movie', 'tv', 'show', 'film', 'series', 'television']);

        // Video Games -> RAWG
        this.registerStrategy(rawgStrategy, ['game', 'rpg', 'console', 'playstation', 'nintendo', 'xbox', 'gaming', 'videogame']);

        // Books -> Google Books
        this.registerStrategy(googleBooksStrategy, ['book', 'novel', 'literature', 'reading']);

        // Podcasts -> iTunes
        this.registerStrategy(itunesPodcastStrategy, ['podcast', 'audio', 'listen']);

        // Music -> Spotify
        this.registerStrategy(spotifyStrategy, ['music', 'album', 'song', 'artist', 'band', 'music_artist', 'music_album']);

        // Audiobooks -> Spotify Audiobooks
        this.registerStrategy(spotifyAudiobooksStrategy, ['audiobook', 'audiobooks', 'spoken_word', 'narrated']);

        // Board Games -> BoardGameGeek
        this.registerStrategy(bggStrategy, ['board_game', 'boardgame', 'tabletop', 'card_game', 'cardgame', 'dice', 'strategy']);

        // Comics -> ComicVine
        const comicVineStrategy = new ComicVineStrategy();
        this.registerStrategy(comicVineStrategy, ['comic', 'comics', 'graphic_novel', 'superhero']);
    }

    /**
     * Register a strategy with multiple keywords.
     */
    private registerStrategy(strategy: MediaStrategy, keywords: string[]): void {
        for (const keyword of keywords) {
            this.strategyRegistry.set(keyword.toLowerCase(), strategy);
        }
    }

    /**
     * Resolve which strategy to use based on category name and/or explicit type.
     * 
     * Resolution order:
     * 1. Explicit type parameter (direct lookup)
     * 2. Category name tokenization (word matching)
     * 3. Default strategy fallback
     */
    private resolveStrategy(categoryName: string, explicitType?: string): MediaStrategy {
        // 1. Fast path: Direct lookup by explicit type
        if (explicitType) {
            const strategy = this.strategyRegistry.get(explicitType.toLowerCase());
            if (strategy) {
                return strategy;
            }
        }

        // 2. Tokenize category name and check each word
        // Split by spaces, hyphens, underscores, etc.
        const tokens = categoryName.toLowerCase().split(/[\s\-_&]+/);

        for (const token of tokens) {
            const strategy = this.strategyRegistry.get(token);
            if (strategy) {
                return strategy;
            }
        }

        // 3. Substring matching for compound words (e.g., "videogames" -> "game")
        const lowerName = categoryName.toLowerCase();
        for (const [keyword, strategy] of this.strategyRegistry.entries()) {
            if (lowerName.includes(keyword)) {
                return strategy;
            }
        }

        // 4. Fallback to default (TMDB)
        return this.defaultStrategy;
    }

    /**
     * Search for media using the appropriate strategy.
     */
    async search(
        query: string,
        categoryName: string,
        settings: SystemSettings,
        type?: string
    ): Promise<MediaSearchResponse> {
        const strategy = this.resolveStrategy(categoryName, type);

        console.log(`[MediaService] Using strategy: ${strategy.name} for category: "${categoryName}"${type ? ` (type: ${type})` : ''}`);

        return await strategy.search(query, settings, type);
    }

    /**
     * Get all registered keywords for debugging/documentation.
     */
    getRegisteredKeywords(): string[] {
        return Array.from(this.strategyRegistry.keys()).sort();
    }
}
