/**
 * Video Game Provider (IGDB)
 * 
 * Handles metadata fetching for: VIDEO_GAME
 */

import { MetadataProvider, ProviderResult, ProviderItem, updateField } from './types'

// Note: IGDB requires Twitch OAuth - we use the existing searchMediaAction
// which handles authentication internally

export const VideoGameProvider: MetadataProvider = {
    name: 'IGDB',
    supportedCategories: ['VIDEO_GAME'],

    async fetchMetadata(item: ProviderItem, force: boolean): Promise<ProviderResult> {
        const enriched: Record<string, any> = {}
        const fieldsUpdated: string[] = []

        try {
            // Use the existing searchMediaAction which handles IGDB auth
            const { searchMediaAction } = await import('@/lib/actions/media')
            const searchResult = await searchMediaAction(item.title, 'VIDEO_GAME', null, undefined)

            if (searchResult.success && searchResult.data?.length > 0) {
                const gameData = searchResult.data[0]
                const mapped = this.mapToSchema(gameData, item, force)
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
        updateField(enriched, existingItem, 'platforms', rawData.platforms, force)
        updateField(enriched, existingItem, 'developers', rawData.developers, force)
        updateField(enriched, existingItem, 'publishers', rawData.publishers, force)
        updateField(enriched, existingItem, 'genres', rawData.genres, force)
        updateField(enriched, existingItem, 'vote_average', rawData.rating, force)

        // Store IGDB ID
        if (rawData.id && (force || !existingItem.external_ids?.igdb)) {
            enriched.external_ids = {
                ...existingItem.external_ids,
                igdb: rawData.id
            }
        }

        return enriched
    }
}

export default VideoGameProvider
