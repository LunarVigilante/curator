/**
 * Podcast Provider
 * 
 * Handles metadata fetching for: PODCAST
 * 
 * Uses Podcast Index API or similar podcast directory.
 */

import { MetadataProvider, ProviderResult, ProviderItem, updateField } from './types'

export const PodcastProvider: MetadataProvider = {
    name: 'Podcast Index',
    supportedCategories: ['PODCAST'],

    async fetchMetadata(item: ProviderItem, force: boolean): Promise<ProviderResult> {
        const enriched: Record<string, any> = {}
        const fieldsUpdated: string[] = []

        try {
            // Use the existing searchMediaAction which handles podcasts
            const { searchMediaAction } = await import('@/lib/actions/media')
            const searchResult = await searchMediaAction(item.title, 'PODCAST', null, undefined)

            if (searchResult.success && searchResult.data?.length > 0) {
                const podcastData = searchResult.data[0]
                const mapped = this.mapToSchema(podcastData, item, force)
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

        updateField(enriched, existingItem, 'image_url', rawData.imageUrl || rawData.artwork, force)
        updateField(enriched, existingItem, 'author', rawData.author || rawData.ownerName, force)
        updateField(enriched, existingItem, 'publisher', rawData.publisher, force)
        updateField(enriched, existingItem, 'description', rawData.description, force)
        updateField(enriched, existingItem, 'genres', rawData.categories || rawData.genres, force)
        updateField(enriched, existingItem, 'episode_count', rawData.episodeCount, force)
        updateField(enriched, existingItem, 'language', rawData.language, force)

        // Metadata
        const metadataUpdates: Record<string, any> = {}
        if (rawData.feedUrl) metadataUpdates.feedUrl = rawData.feedUrl
        if (rawData.itunesId) metadataUpdates.itunesId = rawData.itunesId
        if (rawData.lastUpdateTime) metadataUpdates.lastUpdateTime = rawData.lastUpdateTime
        if (rawData.explicit !== undefined) metadataUpdates.explicit = rawData.explicit

        if (Object.keys(metadataUpdates).length > 0) {
            enriched.metadata = { ...existingItem.metadata, ...metadataUpdates }
        }

        // Store Podcast Index ID
        if (rawData.id && (force || !existingItem.external_ids?.podcastIndex)) {
            enriched.external_ids = {
                ...existingItem.external_ids,
                podcastIndex: rawData.id
            }
        }

        return enriched
    }
}

export default PodcastProvider
