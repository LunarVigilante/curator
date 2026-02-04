/**
 * TMDB Delta Sync Script
 * 
 * Polls the TMDB /tv/changes endpoint to discover recently updated content.
 * More efficient than full re-harvest for keeping data fresh.
 * 
 * Usage:
 *   npx tsx src/scripts/sync-changes.ts
 *   npx tsx src/scripts/sync-changes.ts --lookback 24h
 *   npx tsx src/scripts/sync-changes.ts --lookback 7d --dry-run
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { computeSemanticHash, hasSemanticChanges } from '@/lib/harvesters/shared';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const DEFAULT_LOOKBACK_HOURS = 24;
const PAGE_SIZE = 100;  // TMDB max is 100
const BATCH_SIZE = 50;  // Process in batches for hash comparison

// ============================================================================
// TYPES
// ============================================================================

interface ChangeResult {
    id: number;
    adult: boolean | null;
}

interface DeltaSyncResult {
    changedIds: number;
    reembedRequired: number;
    metadataOnlyChanges: number;
    notInDatabase: number;
    duration: number;
}

// ============================================================================
// LOOKBACK PARSING
// ============================================================================

function parseLookback(lookback: string): number {
    const match = lookback.match(/^(\d+)([hdm])$/);
    if (!match) {
        throw new Error(`Invalid lookback format: ${lookback}. Use format like 24h, 7d, or 30m`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 'm': return value;
        case 'h': return value * 60;
        case 'd': return value * 60 * 24;
        default: return value;
    }
}

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

// ============================================================================
// FETCH CHANGES FROM TMDB
// ============================================================================

async function fetchChanges(
    apiKey: string,
    startDate: Date,
    endDate: Date
): Promise<number[]> {
    const allIds: number[] = [];
    let page = 1;
    let totalPages = 1;

    console.log(`📡 Fetching TV changes from ${formatDate(startDate)} to ${formatDate(endDate)}...`);

    while (page <= totalPages) {
        const url = new URL(`${TMDB_API_BASE}/tv/changes`);
        url.searchParams.set('api_key', apiKey);
        url.searchParams.set('start_date', formatDate(startDate));
        url.searchParams.set('end_date', formatDate(endDate));
        url.searchParams.set('page', String(page));

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        totalPages = data.total_pages || 1;

        const results = (data.results || []) as ChangeResult[];
        const ids = results
            .filter(r => !r.adult)  // Filter out adult content
            .map(r => r.id);

        allIds.push(...ids);

        console.log(`   Page ${page}/${totalPages}: ${ids.length} changes`);
        page++;

        // Rate limit protection
        if (page <= totalPages) {
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }

    // Deduplicate
    const uniqueIds = [...new Set(allIds)];
    console.log(`📊 Found ${uniqueIds.length} unique changed TV shows`);

    return uniqueIds;
}

// ============================================================================
// CHECK WHICH CHANGES REQUIRE RE-EMBEDDING
// ============================================================================

async function analyzeChanges(
    apiKey: string,
    changedIds: number[]
): Promise<{
    reembedIds: number[];
    metadataOnlyIds: number[];
    notFoundIds: number[];
}> {
    const supabase = createServiceRoleClient();
    const reembedIds: number[] = [];
    const metadataOnlyIds: number[] = [];
    const notFoundIds: number[] = [];

    console.log(`\n🔍 Analyzing ${changedIds.length} changed shows for semantic changes...`);

    for (let i = 0; i < changedIds.length; i += BATCH_SIZE) {
        const batch = changedIds.slice(i, i + BATCH_SIZE);

        // Fetch existing records with semantic hashes
        const { data: existingItems, error } = await supabase
            .from('global_items')
            .select('id, title, external_ids, semantic_hash')
            .eq('category_type', 'TV_SHOW')
            .in('external_ids->>tmdb_id', batch.map(String));

        if (error) {
            console.warn(`⚠️ DB query error: ${error.message}`);
            continue;
        }

        const existingMap = new Map<number, { id: string; hash: string | null; title: string }>();
        for (const item of existingItems || []) {
            const tmdbId = item.external_ids?.tmdb_id;
            if (tmdbId) {
                existingMap.set(Number(tmdbId), {
                    id: item.id,
                    hash: item.semantic_hash,
                    title: item.title
                });
            }
        }

        // Check each changed ID
        for (const tmdbId of batch) {
            const existing = existingMap.get(tmdbId);

            if (!existing) {
                notFoundIds.push(tmdbId);
                continue;
            }

            // Fetch fresh data from TMDB to compute new hash
            try {
                const url = `${TMDB_API_BASE}/tv/${tmdbId}?api_key=${apiKey}&append_to_response=credits,keywords`;
                const response = await fetch(url);

                if (!response.ok) {
                    console.warn(`   ⚠️ TMDB ${tmdbId} fetch failed: ${response.status}`);
                    continue;
                }

                const details = await response.json();

                // Compute new hash
                const cast = (details.credits?.cast || []).slice(0, 8).map((c: any) => c.name);
                const genres = (details.genres || []).map((g: any) => g.name);
                const newHash = computeSemanticHash(
                    details.name || details.original_name,
                    details.overview || '',
                    cast,
                    genres
                );

                if (hasSemanticChanges(existing.hash, newHash)) {
                    reembedIds.push(tmdbId);
                    console.log(`   🔄 ${existing.title} (ID: ${tmdbId}) - semantic changes detected`);
                } else {
                    metadataOnlyIds.push(tmdbId);
                }

                // Rate limit
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (err) {
                console.warn(`   ⚠️ Error analyzing ${tmdbId}: ${err}`);
            }
        }

        console.log(`   ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(changedIds.length / BATCH_SIZE)}`);
    }

    return { reembedIds, metadataOnlyIds, notFoundIds: notFoundIds };
}

// ============================================================================
// QUEUE FOR REHYDRATION
// ============================================================================

async function queueForRehydration(ids: number[]): Promise<void> {
    const supabase = createServiceRoleClient();

    // Mark items for rehydration by updating a status field
    const { error } = await supabase
        .from('global_items')
        .update({ rehydration_needed: true })
        .eq('category_type', 'TV_SHOW')
        .in('external_ids->>tmdb_id', ids.map(String));

    if (error) {
        console.warn(`⚠️ Failed to queue for rehydration: ${error.message}`);
    } else {
        console.log(`✅ Queued ${ids.length} shows for rehydration`);
    }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main(): Promise<DeltaSyncResult> {
    const startTime = Date.now();

    // Parse CLI arguments
    const args = process.argv.slice(2);
    const lookbackArg = args.find(a => a.startsWith('--lookback='))?.split('=')[1] || '24h';
    const dryRun = args.includes('--dry-run');

    const lookbackMinutes = parseLookback(lookbackArg);

    console.log(`\n╔══════════════════════════════════════════════════════════════`);
    console.log(`║ TMDB Delta Sync`);
    console.log(`║ Lookback: ${lookbackArg} (${lookbackMinutes} minutes)`);
    console.log(`║ Dry Run: ${dryRun}`);
    console.log(`╚══════════════════════════════════════════════════════════════\n`);

    // Get API key from environment
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        throw new Error('TMDB_API_KEY environment variable is required');
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - lookbackMinutes * 60 * 1000);

    // Step 1: Fetch changes from TMDB
    const changedIds = await fetchChanges(apiKey, startDate, endDate);

    if (changedIds.length === 0) {
        console.log(`\n✅ No changes found in the last ${lookbackArg}`);
        return {
            changedIds: 0,
            reembedRequired: 0,
            metadataOnlyChanges: 0,
            notInDatabase: 0,
            duration: Date.now() - startTime
        };
    }

    // Step 2: Analyze which changes require re-embedding
    const { reembedIds, metadataOnlyIds, notFoundIds } = await analyzeChanges(apiKey, changedIds);

    // Step 3: Queue for rehydration (unless dry run)
    if (!dryRun && reembedIds.length > 0) {
        await queueForRehydration(reembedIds);
    } else if (dryRun) {
        console.log(`\n🔍 DRY RUN - Would queue ${reembedIds.length} shows for rehydration`);
    }

    const duration = Date.now() - startTime;

    console.log(`\n╔══════════════════════════════════════════════════════════════`);
    console.log(`║ Summary:`);
    console.log(`║   Changed IDs found: ${changedIds.length}`);
    console.log(`║   Re-embed required: ${reembedIds.length}`);
    console.log(`║   Metadata-only changes: ${metadataOnlyIds.length}`);
    console.log(`║   Not in database: ${notFoundIds.length}`);
    console.log(`║   Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`╚══════════════════════════════════════════════════════════════\n`);

    return {
        changedIds: changedIds.length,
        reembedRequired: reembedIds.length,
        metadataOnlyChanges: metadataOnlyIds.length,
        notInDatabase: notFoundIds.length,
        duration
    };
}

// Run if called directly
main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(`❌ Fatal error: ${err.message}`);
        process.exit(1);
    });

export { main as runDeltaSync, type DeltaSyncResult };
