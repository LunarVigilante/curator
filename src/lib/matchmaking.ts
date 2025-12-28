import { db } from '@/lib/db';
import { items } from '@/db/schema';
import { eq, and, not, isNotNull, inArray } from 'drizzle-orm';

/**
 * Calculates a "Taste Match" percentage between two users based on their item ratings.
 * 
 * Logic:
 * 1. Find items rated by both users (eloScore != 1200).
 * 2. Calculate absolute difference in ELO for each shared item.
 * 3. Normalize the difference to a percentage.
 * 
 * @returns number (0-100) or null if insufficient data (< 5 shared items).
 */
export async function calculateTasteMatch(userIdA: string, userIdB: string): Promise<number | null> {
    // 1. Get User A's rated items
    const userAItems = await db.select({
        globalItemId: items.globalItemId,
        eloScore: items.eloScore,
        name: items.name, // Fallback for matching if globalItemId is missing in some legacy data
    })
        .from(items)
        .where(
            and(
                eq(items.userId, userIdA),
                not(eq(items.eloScore, 1200)), // Ignore default score
                isNotNull(items.globalItemId) // We need global ID for accurate matching
            )
        );

    if (userAItems.length === 0) return null;

    const userAGlobalIds = userAItems.map(i => i.globalItemId).filter(Boolean) as string[];

    if (userAGlobalIds.length === 0) return null;

    // 2. Get User B's rated items that match User A's global IDs
    const userBItems = await db.select({
        globalItemId: items.globalItemId,
        eloScore: items.eloScore,
    })
        .from(items)
        .where(
            and(
                eq(items.userId, userIdB),
                not(eq(items.eloScore, 1200)),
                inArray(items.globalItemId, userAGlobalIds)
            )
        );

    // 3. Match them up
    let totalDiff = 0;
    let matchCount = 0;

    // Create a map for User A's scores for O(1) lookup
    const userAScoreMap = new Map<string, number>();
    userAItems.forEach(item => {
        if (item.globalItemId) userAScoreMap.set(item.globalItemId, item.eloScore);
    });

    for (const itemB of userBItems) {
        if (!itemB.globalItemId) continue;

        const scoreA = userAScoreMap.get(itemB.globalItemId);
        if (scoreA !== undefined) {
            totalDiff += Math.abs(scoreA - itemB.eloScore);
            matchCount++;
        }
    }

    // Step B: Insufficient data check
    if (matchCount < 5) return null;

    // Step C: The Algorithm
    const averageDiff = totalDiff / matchCount;

    // Define MaxPossibleDiff for normalization.
    // ELO usually ranges from ~1000 to ~1400 in this app (default 1200). 
    // A diff of 400 is statistically huge. Let's be generous and say 800 is "polar opposite".
    const MAX_POSSIBLE_DIFF = 800;

    // Calculate percentage
    // If averageDiff is 0, match is 100%.
    // If averageDiff is MAX_POSSIBLE_DIFF, match is 0%.
    const matchPercentage = Math.max(0, 100 - (averageDiff / MAX_POSSIBLE_DIFF * 100));

    return Math.round(matchPercentage);
}
