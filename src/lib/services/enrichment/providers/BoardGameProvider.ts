/**
 * Board Game Provider (BoardGameGeek)
 * 
 * Handles metadata fetching for: BOARD_GAME
 */

import { MetadataProvider, ProviderResult, ProviderItem, updateField } from './types'

export const BoardGameProvider: MetadataProvider = {
    name: 'BoardGameGeek',
    supportedCategories: ['BOARD_GAME'],

    async fetchMetadata(item: ProviderItem, force: boolean): Promise<ProviderResult> {
        const enriched: Record<string, any> = {}
        const fieldsUpdated: string[] = []

        try {
            // Use the existing searchMediaAction which handles BGG
            const { searchMediaAction } = await import('@/lib/actions/media')
            const searchResult = await searchMediaAction(item.title, 'BOARD_GAME', null, undefined)

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
        updateField(enriched, existingItem, 'designers', rawData.designers, force)
        updateField(enriched, existingItem, 'publishers', rawData.publishers, force)
        updateField(enriched, existingItem, 'min_players', rawData.minPlayers, force)
        updateField(enriched, existingItem, 'max_players', rawData.maxPlayers, force)
        updateField(enriched, existingItem, 'complexity', rawData.complexity, force)
        updateField(enriched, existingItem, 'vote_average', rawData.rating, force)
        updateField(enriched, existingItem, 'mechanics', rawData.mechanics, force)
        updateField(enriched, existingItem, 'genres', rawData.categories, force)

        // Store BGG ID
        if (rawData.id && (force || !existingItem.external_ids?.bgg)) {
            enriched.external_ids = {
                ...existingItem.external_ids,
                bgg: rawData.id
            }
        }

        return enriched
    }
}

export default BoardGameProvider
