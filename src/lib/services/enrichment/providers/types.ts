/**
 * Base Metadata Provider Interface
 * 
 * Each category-specific provider implements this interface.
 * This allows for clean separation of provider logic per category.
 */

export interface ProviderResult {
    success: boolean
    data: Record<string, any>
    fieldsUpdated: string[]
    providerName: string
    error?: string
}

export interface MetadataProvider {
    /**
     * Name of the provider (e.g., "TMDB", "IGDB", "BGG")
     */
    name: string

    /**
     * Categories this provider supports
     */
    supportedCategories: string[]

    /**
     * Fetch metadata for an item
     */
    fetchMetadata(item: ProviderItem, force: boolean): Promise<ProviderResult>

    /**
     * Map raw provider data to our schema
     */
    mapToSchema(rawData: any, existingItem: any, force: boolean): Record<string, any>
}

export interface ProviderItem {
    id: string
    title: string
    category_type: string
    release_year?: number
    external_ids?: Record<string, any>
    metadata?: Record<string, any>
    [key: string]: any
}

/**
 * Helper to conditionally update a field
 */
export function updateField(
    enriched: Record<string, any>,
    existingItem: any,
    field: string,
    value: any,
    force: boolean
): void {
    if (value !== undefined && value !== null && value !== '') {
        if (force || existingItem[field] === null || existingItem[field] === undefined || existingItem[field] === '') {
            enriched[field] = value
        }
    }
}
