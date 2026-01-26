/**
 * Anime Provider (AniList)
 * 
 * Handles metadata fetching for: ANIME, MANGA, LIGHT_NOVEL
 */

import { MetadataProvider, ProviderResult, ProviderItem, updateField } from './types'

export const AnimeProvider: MetadataProvider = {
    name: 'AniList',
    supportedCategories: ['ANIME', 'MANGA', 'LIGHT_NOVEL'],

    async fetchMetadata(item: ProviderItem, force: boolean): Promise<ProviderResult> {
        const enriched: Record<string, any> = {}
        const fieldsUpdated: string[] = []

        try {
            // Use the existing searchMediaAction which handles AniList
            const { searchMediaAction } = await import('@/lib/actions/media')
            const searchResult = await searchMediaAction(item.title, item.category_type, null, undefined)

            if (searchResult.success && searchResult.data?.length > 0) {
                const animeData = searchResult.data[0]
                const mapped = this.mapToSchema(animeData, item, force)
                Object.assign(enriched, mapped)
                fieldsUpdated.push(...Object.keys(mapped))
            }

            return {
                success: true,
                data: enriched,
                fieldsUpdated: [...new Set(fieldsUpdated)],
                providerName: this.name
            }

        } catch (error: any) {
            return {
                success: false,
                data: {},
                fieldsUpdated: [],
                providerName: this.name,
                error: error.message
            }
        }
    },

    mapToSchema(rawData: any, existingItem: any, force: boolean): Record<string, any> {
        const enriched: Record<string, any> = {}

        updateField(enriched, existingItem, 'image_url', rawData.imageUrl, force)
        updateField(enriched, existingItem, 'release_year', rawData.year || rawData.releaseYear, force)
        updateField(enriched, existingItem, 'romaji_title', rawData.romaji_title, force)
        updateField(enriched, existingItem, 'anilist_score', rawData.score, force)
        updateField(enriched, existingItem, 'status', rawData.status, force)
        updateField(enriched, existingItem, 'genres', rawData.genres, force)
        updateField(enriched, existingItem, 'studios', rawData.studios, force)
        updateField(enriched, existingItem, 'episodes', rawData.episodes, force)
        updateField(enriched, existingItem, 'vote_average', rawData.score ? rawData.score / 10 : null, force)

        // Metadata
        const metadataUpdates: Record<string, any> = {}
        if (rawData.season) metadataUpdates.season = rawData.season
        if (rawData.seasonYear) metadataUpdates.seasonYear = rawData.seasonYear
        if (rawData.source) metadataUpdates.source = rawData.source
        if (rawData.format) metadataUpdates.format = rawData.format

        if (Object.keys(metadataUpdates).length > 0) {
            enriched.metadata = { ...existingItem.metadata, ...metadataUpdates }
        }

        // Store AniList ID
        if (rawData.id && (force || !existingItem.external_ids?.anilist)) {
            enriched.external_ids = {
                ...existingItem.external_ids,
                anilist: rawData.id
            }
        }

        return enriched
    }
}

export default AnimeProvider
