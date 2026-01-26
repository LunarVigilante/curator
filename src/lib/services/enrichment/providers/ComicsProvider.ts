/**
 * Comics Provider
 * 
 * Handles metadata fetching for: COMICS
 * 
 * Uses Comic Vine API or similar comic database.
 */

import { MetadataProvider, ProviderResult, ProviderItem, updateField } from './types'

export const ComicsProvider: MetadataProvider = {
    name: 'Comic Vine',
    supportedCategories: ['COMICS', 'COMIC'],

    async fetchMetadata(item: ProviderItem, force: boolean): Promise<ProviderResult> {
        const enriched: Record<string, any> = {}
        const fieldsUpdated: string[] = []

        try {
            // Use the existing searchMediaAction which may handle comics
            const { searchMediaAction } = await import('@/lib/actions/media')
            const searchResult = await searchMediaAction(item.title, 'COMICS', null, undefined)

            if (searchResult.success && searchResult.data?.length > 0) {
                const comicData = searchResult.data[0]
                const mapped = this.mapToSchema(comicData, item, force)
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
        updateField(enriched, existingItem, 'author', rawData.writer || rawData.authors?.[0], force)
        updateField(enriched, existingItem, 'artist', rawData.artist || rawData.penciler, force)
        updateField(enriched, existingItem, 'publisher', rawData.publisher, force)
        updateField(enriched, existingItem, 'description', rawData.description || rawData.deck, force)
        updateField(enriched, existingItem, 'genres', rawData.genres, force)
        updateField(enriched, existingItem, 'issue_count', rawData.count_of_issues, force)

        // Metadata
        const metadataUpdates: Record<string, any> = {}
        if (rawData.start_year) metadataUpdates.start_year = rawData.start_year
        if (rawData.first_issue) metadataUpdates.first_issue = rawData.first_issue
        if (rawData.last_issue) metadataUpdates.last_issue = rawData.last_issue

        if (Object.keys(metadataUpdates).length > 0) {
            enriched.metadata = { ...existingItem.metadata, ...metadataUpdates }
        }

        // Store Comic Vine ID
        if (rawData.id && (force || !existingItem.external_ids?.comicVine)) {
            enriched.external_ids = {
                ...existingItem.external_ids,
                comicVine: rawData.id
            }
        }

        return enriched
    }
}

export default ComicsProvider
