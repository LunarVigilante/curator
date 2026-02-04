/**
 * Category-Specific Enrichment Dispatcher
 * 
 * Routes enrichment requests to the appropriate category-specific module.
 * Keeps shared.ts thin by delegating to specialized implementations.
 * 
 * Currently supported categories with specialized logic:
 * - TV_SHOW: Semantic Weaving descriptions, 4-bucket taxonomy tags
 * 
 * All other categories use the default module.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getLLMConfig } from '@/lib/harvesters/shared';
import { generateTvShowTags } from './categories/tv-show';
import { generateDefaultTags } from './categories/default';

// Re-export category-specific modules for direct access
export * from './categories/tv-show';
export * from './categories/default';

// ============================================================================
// TAG GENERATION DISPATCHER
// ============================================================================

/**
 * Generate tags for an item, routing to category-specific logic as needed.
 * 
 * Specialized categories:
 * - TV_SHOW / TV Show / TV: Uses 4-bucket taxonomy (15-20 tags)
 * 
 * All others: Uses default comma-separated format (3-8 tags)
 */
export async function generateTags(
    supabase: ReturnType<typeof createServiceRoleClient>,
    title: string,
    description: string,
    type: string
): Promise<string[]> {
    const config = await getLLMConfig(supabase);
    if (!config.apiKey) return [];

    // Route to category-specific module
    switch (type) {
        case 'TV_SHOW':
        case 'TV Show':
        case 'TV':
            return generateTvShowTags(config, title, description);

        // Future: Add more specialized categories here
        // case 'MOVIE':
        //     return generateMovieTags(config, title, description);

        default:
            return generateDefaultTags(config, title, description, type);
    }
}
