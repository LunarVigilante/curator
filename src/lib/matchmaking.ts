import { createClient } from '@/lib/supabase/server';

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
    const supabase = await createClient();

    // 1. Get User A's rated items
    const { data: userAItems } = await supabase
        .from('items')
        .select('global_item_id, elo_score, name')
        .eq('user_id', userIdA)
        .neq('elo_score', 1200) // Ignore default score
        .not('global_item_id', 'is', null);

    if (!userAItems || userAItems.length === 0) return null;

    const userAGlobalIds = userAItems.map(i => i.global_item_id).filter(Boolean) as string[];

    if (userAGlobalIds.length === 0) return null;

    // 2. Get User B's rated items that match User A's global IDs
    const { data: userBItems } = await supabase
        .from('items')
        .select('global_item_id, elo_score')
        .eq('user_id', userIdB)
        .neq('elo_score', 1200)
        .in('global_item_id', userAGlobalIds);

    if (!userBItems) return null;

    // 3. Match them up
    let totalDiff = 0;
    let matchCount = 0;

    // Create a map for User A's scores for O(1) lookup
    const userAScoreMap = new Map<string, number>();
    userAItems.forEach(item => {
        if (item.global_item_id) userAScoreMap.set(item.global_item_id, item.elo_score);
    });

    for (const itemB of userBItems) {
        if (!itemB.global_item_id) continue;

        const scoreA = userAScoreMap.get(itemB.global_item_id);
        if (scoreA !== undefined) {
            totalDiff += Math.abs(scoreA - itemB.elo_score);
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
