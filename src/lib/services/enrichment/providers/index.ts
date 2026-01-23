/**
 * Provider Registry
 * 
 * Maps categories to their metadata providers.
 * This is the central routing logic for metadata enrichment.
 * 
 * Provider Coverage:
 * - TMDBProvider      → MOVIE, TV_SHOW, TV
 * - VideoGameProvider → VIDEO_GAME
 * - BoardGameProvider → BOARD_GAME
 * - AnimeProvider     → ANIME, MANGA, LIGHT_NOVEL
 * - MusicProvider     → MUSIC_ALBUM, MUSIC_TRACK, MUSIC_ARTIST, ALBUM
 * - BookProvider      → BOOK, BOOKS
 * - PodcastProvider   → PODCAST
 * - ComicsProvider    → COMICS, COMIC
 */

import { MetadataProvider } from './types'
import { TMDBProvider } from './TMDBProvider'
import { VideoGameProvider } from './VideoGameProvider'
import { BoardGameProvider } from './BoardGameProvider'
import { AnimeProvider } from './AnimeProvider'
import { MusicProvider } from './MusicProvider'
import { BookProvider } from './BookProvider'
import { PodcastProvider } from './PodcastProvider'
import { ComicsProvider } from './ComicsProvider'

// Registry of all available providers
const providers: MetadataProvider[] = [
    TMDBProvider,
    VideoGameProvider,
    BoardGameProvider,
    AnimeProvider,
    MusicProvider,
    BookProvider,
    PodcastProvider,
    ComicsProvider
]

// Build category -> provider lookup
const categoryProviderMap = new Map<string, MetadataProvider>()

for (const provider of providers) {
    for (const category of provider.supportedCategories) {
        categoryProviderMap.set(category, provider)
    }
}

/**
 * Get the appropriate metadata provider for a category
 */
export function getProviderForCategory(category: string): MetadataProvider | null {
    return categoryProviderMap.get(category) || null
}

/**
 * Get all registered providers
 */
export function getAllProviders(): MetadataProvider[] {
    return [...providers]
}

/**
 * Get all supported categories
 */
export function getAllSupportedCategories(): string[] {
    return Array.from(categoryProviderMap.keys())
}

/**
 * Check if a category has a provider
 */
export function hasProvider(category: string): boolean {
    return categoryProviderMap.has(category)
}

// Export individual providers for direct use if needed
export {
    TMDBProvider,
    VideoGameProvider,
    BoardGameProvider,
    AnimeProvider,
    MusicProvider,
    BookProvider,
    PodcastProvider,
    ComicsProvider
}
