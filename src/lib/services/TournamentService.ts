import { createClient } from '@/lib/supabase/server';
import { MediaService } from './media/mediaService';
import { SystemConfigService } from './SystemConfigService';

// =============================================================================
// SLIM DTO FOR TOURNAMENT UI
// Only essential fields needed for voting cards - no payload bloat
// =============================================================================

export interface TournamentPoolItem {
    id: string
    name: string
    image: string | null
    eloScore: number
    type: 'USER' | 'CHALLENGER'
    description: string | null
    /** External ID for saving challenger items if they win */
    externalId?: string
}

/** Truncate description to avoid payload bloat */
function truncateDescription(desc: string | null | undefined, maxLength = 300): string | null {
    if (!desc) return null
    if (desc.length <= maxLength) return desc
    return desc.substring(0, maxLength - 3) + '...'
}

export class TournamentService {
    /**
     * Generates a tournament pool for the user.
     * Returns a SLIM DTO array - no heavy metadata fields.
     * 
     * Logic:
     * 1. Fetch user's active items (ACTIVE).
     * 2. If < poolSize && includeUnseen, fetch Popular global items not in user's library.
     * 3. If still empty, fetch External items via MediaService.
     */
    static async generateTournamentPool(
        userId: string,
        categoryId: string,
        poolSize: number = 20,
        includeUnseen: boolean = true
    ): Promise<TournamentPoolItem[]> {
        const supabase = await createClient();

        // 1. Fetch active user items
        const { data: userItems } = await supabase
            .from('items')
            .select('id, name, image, elo_score, description')
            .eq('user_id', userId)
            .eq('category_id', categoryId)
            .eq('status', 'ACTIVE')
            .limit(poolSize);

        // Map user items to slim DTO
        const userPoolItems: TournamentPoolItem[] = ((userItems as any[]) || []).map(i => ({
            id: i.id,
            name: i.name || 'Untitled',
            image: i.image,
            eloScore: i.elo_score,
            type: 'USER' as const,
            description: truncateDescription(i.description)
        }));

        // If we have enough items or user doesn't want unseen, return shuffled
        if (userPoolItems.length >= poolSize || !includeUnseen) {
            return userPoolItems.sort(() => Math.random() - 0.5);
        }

        const needed = poolSize - userPoolItems.length;

        // 2. Fetch Global Popular Items (excluding ones user has interacted with)
        // (Query removed as unused)



        // 3. External Fallback (Discovery)
        const { data: category } = await (supabase
            .from('categories') as any)
            .select('id, name')
            .eq('id', categoryId)
            .single();

        if (!category) return userPoolItems;

        const mediaService = new MediaService();
        const settings = await SystemConfigService.getRawConfigMap();

        // Search for popular/trending items
        const discoveryResults = await mediaService.search("top", category.name, settings || {});

        if (!discoveryResults.success) return userPoolItems;

        // Filter out things user already has
        const existingNames = new Set(userPoolItems.map(i => i.name.toLowerCase()));

        const newCandidates = discoveryResults.data
            .filter(r => !existingNames.has(r.title.toLowerCase()))
            .filter(r => r.imageUrl && r.imageUrl.length > 0) // CRITICAL: Only show challengers with images
            .slice(0, needed);

        // Convert candidates to slim DTO - NO heavy metadata field
        const challengerItems: TournamentPoolItem[] = newCandidates.map(c => ({
            id: `temp-${Math.random().toString(36).substring(7)}`,
            name: c.title,
            image: c.imageUrl,
            eloScore: 1200,
            type: 'CHALLENGER' as const,
            description: truncateDescription(c.description),
            // Only store the external ID needed to save the item later
            externalId: c.id
        }));

        // Return unified slim array
        return [
            ...userPoolItems,
            ...challengerItems
        ].sort(() => Math.random() - 0.5);
    }
}
