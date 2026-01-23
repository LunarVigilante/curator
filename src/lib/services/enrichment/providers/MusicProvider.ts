/**
 * Music Provider (Spotify)
 * 
 * Handles metadata fetching for: MUSIC_ALBUM, MUSIC_TRACK, MUSIC_ARTIST
 */

import { MetadataProvider, ProviderResult, ProviderItem, updateField } from './types'

export const MusicProvider: MetadataProvider = {
    name: 'Spotify',
    supportedCategories: ['MUSIC_ALBUM', 'MUSIC_TRACK', 'MUSIC_ARTIST', 'ALBUM'],

    async fetchMetadata(item: ProviderItem, force: boolean): Promise<ProviderResult> {
        const enriched: Record<string, any> = {}
        const fieldsUpdated: string[] = []

        try {
            // Use the existing searchMediaAction which handles Spotify
            const { searchMediaAction } = await import('@/lib/actions/media')
            const searchResult = await searchMediaAction(item.title, item.category_type, null, undefined)

            if (searchResult.success && searchResult.data?.length > 0) {
                const musicData = searchResult.data[0]
                const mapped = this.mapToSchema(musicData, item, force)
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
        updateField(enriched, existingItem, 'artist_names', rawData.artists || rawData.artistNames, force)
        updateField(enriched, existingItem, 'label', rawData.label, force)
        updateField(enriched, existingItem, 'popularity', rawData.popularity, force)
        updateField(enriched, existingItem, 'spotify_url', rawData.spotify_url || rawData.external_urls?.spotify, force)
        updateField(enriched, existingItem, 'preview_url', rawData.preview_url, force)
        updateField(enriched, existingItem, 'genres', rawData.genres, force)
        updateField(enriched, existingItem, 'duration_ms', rawData.duration_ms, force)
        updateField(enriched, existingItem, 'track_count', rawData.total_tracks, force)

        // Store Spotify ID
        if (rawData.id && (force || !existingItem.external_ids?.spotify)) {
            enriched.external_ids = {
                ...existingItem.external_ids,
                spotify: rawData.id
            }
        }

        return enriched
    }
}

export default MusicProvider
