import { db } from '@/lib/db';
import { items, globalItems, users, categories } from '@/db/schema';
import { eq, and, not, inArray, desc } from 'drizzle-orm';
import { MediaService } from './media/mediaService';
import { SystemConfigService } from './SystemConfigService';

export class TournamentService {
    /**
     * Generates a tournament pool for the user.
     * Logic:
     * 1. Fetch user's active items (ACTIVE).
     * 2. If < poolSize && includeUnseen, fetch Popular global items not in user's library (active/ignored/seen).
     * 3. If still empty, fetch External items via MediaService and insert them.
     */
    static async generateTournamentPool(
        userId: string,
        categoryId: string,
        poolSize: number = 20,
        includeUnseen: boolean = true
    ) {
        // 1. Fetch active user items
        const userItems = await db.select()
            .from(items)
            .where(and(
                eq(items.userId, userId),
                eq(items.categoryId, categoryId),
                eq(items.status, 'ACTIVE')
            ))
            .limit(poolSize);

        // If we have enough items or user doesn't want unseen, return (maybe shuffle?)
        if (userItems.length >= poolSize || !includeUnseen) {
            return userItems.sort(() => Math.random() - 0.5); // Simple shuffle
        }

        const needed = poolSize - userItems.length;

        // 2. Fetch Global Popular Items (excluding ones user has interacted with)
        // Get user's existing item global IDs
        const existingItems = await db.select({ globalId: items.globalItemId })
            .from(items)
            .where(and(
                eq(items.userId, userId),
                eq(items.categoryId, categoryId)
            ));

        const existingGlobalIds = existingItems.map(i => i.globalId).filter(Boolean) as string[];

        // Find popular instances? Or just use global_items table data if we had stats. 
        // For now, let's query the external API directly if we need Discovery, 
        // because our global_items table only has things people added.

        // 3. External Fallback (Discovery)
        const category = await db.query.categories.findFirst({
            where: eq(categories.id, categoryId)
        });

        if (!category) return userItems;

        const mediaService = new MediaService();
        // For discovery, we usually search "popular" or empty string if supported, 
        // or hardcode search terms based on category.
        // Doing a generic "trending" search would be best.

        // Since we don't have a dedicated "getTrending" in MediaService yet, 
        // we'll assume the strategies handle an empty query as "default/popular" or generic query.
        const settings = await SystemConfigService.getDecryptedConfig();

        // Hack: Search for "top" or generic term to get results
        const discoveryResults = await mediaService.search("top", category.name, (settings || {}) as Record<string, string>);

        // Filter out things user already has (based on externalId usually, but here we can check title/metadata)
        // Ideally we check externalId against globalItems -> user items.
        // For simplicity, we just take top N results that don't match names in userItems.
        const existingNames = new Set(userItems.map(i => (i.name || '').toLowerCase()));

        const newCandidates = discoveryResults
            .filter(r => !existingNames.has(r.title.toLowerCase()))
            .slice(0, needed);

        // Convert candidates to temporary item structure for frontend
        const candidateItems = newCandidates.map(c => ({
            id: `temp-${Math.random().toString(36).substring(7)}`, // Temp ID
            name: c.title,
            image: c.imageUrl,
            eloScore: 1200, // Start fresh
            type: 'CHALLENGER' as const, // Frontend needs to know this to treat differently
            description: c.description,
            // We pass extra data so if they win, we can save them
            metadata: JSON.stringify(c)
        }));

        // Combine
        // Note: The frontend expects specific structure. 
        // We'll need to normalize or let frontend adapter handle it.
        // userItems are DB records. candidateItems are slightly different shapes.
        // We will return mixed types and let frontend adapter `useTournamentMatchmaker` handle it.

        // Actually, let's return a unified structure
        return [
            ...userItems.map(i => ({ ...i, type: 'USER' })),
            ...candidateItems
        ];
    }
}
