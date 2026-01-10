/**
 * BGG Lists Harvester - Trending/Hot games and GeekLists
 * Uses the reusable processBGGIds from board-games.ts
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestResult, sleep } from './shared';
import { fetchFromBgg, processBGGIds } from './board-games';

// ============================================================================
// HOTNESS (Trending Games)
// ============================================================================

/**
 * Harvest BGG "Hotness" - currently trending/popular games
 * Endpoint: GET /hot?type=boardgame
 */
export async function harvestHotness(
    supabase: ReturnType<typeof createServiceRoleClient>
): Promise<HarvestResult> {
    console.log('\n🔥 HARVESTING BGG HOTNESS (Trending Games)...');

    try {
        const xml = await fetchFromBgg('hot?type=boardgame');

        // Parse XML to extract IDs
        // Format: <item id="123" rank="1">...</item>
        const idMatches = xml.matchAll(/<item\s+id="(\d+)"/g);
        const ids = Array.from(idMatches).map(m => parseInt(m[1]));

        if (ids.length === 0) {
            console.log('   ⚠️ No games found in Hotness list');
            return { success: 0, skipped: 0, failed: 0, category: 'BGG Hotness' };
        }

        console.log(`   📋 Found ${ids.length} trending games`);

        return await processBGGIds(supabase, ids, 'bgg_hotness');
    } catch (error) {
        console.error('❌ Failed to fetch BGG Hotness:', error);
        return { success: 0, skipped: 0, failed: 0, category: 'BGG Hotness' };
    }
}

// ============================================================================
// GEEKLIST (User-curated lists)
// ============================================================================

/**
 * Harvest a specific BGG GeekList by ID
 * Endpoint: GET /geeklist/{listId}
 * 
 * Popular GeekLists:
 * - 306630: Top 100 Solo Games
 * - 278832: Best Two-Player Only Games  
 * - 164153: Gateway Games
 */
export async function harvestGeekList(
    supabase: ReturnType<typeof createServiceRoleClient>,
    listId: number,
    listName?: string
): Promise<HarvestResult> {
    const displayName = listName || `GeekList #${listId}`;
    console.log(`\n📋 HARVESTING BGG GEEKLIST: ${displayName}...`);

    try {
        const xml = await fetchFromBgg(`geeklist/${listId}`);

        // Parse XML to extract objectids (game IDs)
        // Format: <item id="..." objecttype="thing" subtype="boardgame" objectid="123">
        const idMatches = xml.matchAll(/objectid="(\d+)"/g);
        const ids = Array.from(idMatches).map(m => parseInt(m[1]));

        // Deduplicate
        const uniqueIds = [...new Set(ids)];

        if (uniqueIds.length === 0) {
            console.log('   ⚠️ No games found in GeekList');
            return { success: 0, skipped: 0, failed: 0, category: displayName };
        }

        console.log(`   📋 Found ${uniqueIds.length} games in list`);

        // Process in chunks of 100 for memory management
        const CHUNK_SIZE = 100;
        let totalSuccess = 0, totalFailed = 0;

        for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
            const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
            console.log(`   📦 Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(uniqueIds.length / CHUNK_SIZE)} (${chunk.length} games)`);

            const result = await processBGGIds(supabase, chunk, `geeklist_${listId}`);
            totalSuccess += result.success;
            totalFailed += result.failed;

            // Brief pause between chunks
            if (i + CHUNK_SIZE < uniqueIds.length) {
                await sleep(2000);
            }
        }

        console.log(`✅ ${displayName}: ${totalSuccess} added, ${totalFailed} failed`);
        return { success: totalSuccess, skipped: 0, failed: totalFailed, category: displayName };
    } catch (error) {
        console.error(`❌ Failed to fetch GeekList ${listId}:`, error);
        return { success: 0, skipped: 0, failed: 0, category: displayName };
    }
}

// ============================================================================
// CONVENIENCE: Popular GeekLists
// ============================================================================

export const POPULAR_GEEKLISTS = {
    TOP_SOLO: { id: 306630, name: 'Top 100 Solo Games' },
    BEST_TWO_PLAYER: { id: 278832, name: 'Best Two-Player Only Games' },
    GATEWAY_GAMES: { id: 164153, name: 'Gateway Games' },
    PARTY_GAMES: { id: 41186, name: 'Best Party Games' },
    FAMILY_GAMES: { id: 186827, name: 'Best Family Games' },
};
