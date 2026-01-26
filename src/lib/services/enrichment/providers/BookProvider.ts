/**
 * Book Provider (Google Books)
 * 
 * Handles metadata fetching for: BOOK
 */

import { MetadataProvider, ProviderResult, ProviderItem, updateField } from './types'

export const BookProvider: MetadataProvider = {
    name: 'Google Books',
    supportedCategories: ['BOOK', 'BOOKS'],

    async fetchMetadata(item: ProviderItem, force: boolean): Promise<ProviderResult> {
        const enriched: Record<string, any> = {}
        const fieldsUpdated: string[] = []

        try {
            // Use the existing searchMediaAction which handles Google Books
            const { searchMediaAction } = await import('@/lib/actions/media')
            const searchResult = await searchMediaAction(item.title, 'BOOK', null, undefined)

            if (searchResult.success && searchResult.data?.length > 0) {
                const bookData = searchResult.data[0]
                const mapped = this.mapToSchema(bookData, item, force)
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
        updateField(enriched, existingItem, 'author', rawData.authors?.[0], force)
        updateField(enriched, existingItem, 'publisher', rawData.publisher, force)
        updateField(enriched, existingItem, 'isbn', rawData.isbn, force)
        updateField(enriched, existingItem, 'page_count', rawData.pageCount, force)
        updateField(enriched, existingItem, 'genres', rawData.categories, force)
        updateField(enriched, existingItem, 'description', rawData.description, force)

        // Metadata
        const metadataUpdates: Record<string, any> = {}
        if (rawData.publishedDate) metadataUpdates.publishedDate = rawData.publishedDate
        if (rawData.language) metadataUpdates.language = rawData.language
        if (rawData.maturityRating) metadataUpdates.maturityRating = rawData.maturityRating

        if (Object.keys(metadataUpdates).length > 0) {
            enriched.metadata = { ...existingItem.metadata, ...metadataUpdates }
        }

        // Store Google Books ID
        if (rawData.id && (force || !existingItem.external_ids?.googleBooks)) {
            enriched.external_ids = {
                ...existingItem.external_ids,
                googleBooks: rawData.id
            }
        }

        return enriched
    }
}

export default BookProvider
