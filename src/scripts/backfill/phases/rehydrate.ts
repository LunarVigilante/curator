/**
 * TV Show Re-Hydration Phase
 * 
 * "Re-Hydration" Strategy:
 * - Fetches FRESH metadata from TMDB (seasons, episodes, status, ratings)
 * - Uses CACHED description_parts (no LLM call - saves 98% cost)
 * - Rebuilds embedding text with fresh stats
 * - Re-embeds with Voyage-4 only
 * 
 * This keeps vectors accurate without burning LLM tokens.
 */

import { generateEmbedding, sleep } from '@/lib/harvesters/shared';
import { buildTvShowEmbeddingText } from '@/lib/ai/tv-show-description';
import { CLIOptions, PhaseStats, createStats, DELAY_BETWEEN_ITEMS } from '../config';

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Staleness thresholds in days
const STALENESS_THRESHOLDS: Record<string, number> = {
    'Returning Series': 7,    // Weekly
    'In Production': 30,      // Monthly
    'Planned': 30,            // Monthly
    'Ended': 90,              // Quarterly
    'Canceled': 90,           // Quarterly
    'default': 30             // Monthly fallback
};

interface RehydrateOptions extends CLIOptions {
    status?: string;           // Filter by status
    detectNewSeasons?: boolean; // Only items with season count mismatch
    staleOnly?: boolean;       // Only items past their staleness threshold
}

/**
 * Fetch fresh TV show details from TMDB
 */
async function fetchFreshTmdbData(tmdbId: number | string): Promise<any | null> {
    if (!TMDB_API_KEY) return null;

    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=content_ratings,external_ids`;

    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error('[Rehydrate] TMDB fetch error:', e);
        return null;
    }
}

/**
 * Check if item is stale based on status and last rehydration
 */
function isStale(item: any): boolean {
    if (!item.last_rehydrated_at) return true; // Never rehydrated

    const lastRehydrated = new Date(item.last_rehydrated_at);
    const now = new Date();
    const daysSince = (now.getTime() - lastRehydrated.getTime()) / (1000 * 60 * 60 * 24);

    const status = item.status || 'default';
    const threshold = STALENESS_THRESHOLDS[status] || STALENESS_THRESHOLDS['default'];

    return daysSince >= threshold;
}

/**
 * Main rehydrate phase
 */
export async function runRehydratePhase(
    supabase: any,
    options: RehydrateOptions
): Promise<PhaseStats> {
    const stats = createStats();

    console.log('\n' + '─'.repeat(70));
    console.log('🔄 PHASE: RE-HYDRATION (Fresh Stats + Cached Descriptions)');
    console.log('─'.repeat(70));
    console.log('   Strategy: Fetch fresh TMDB data, use CACHED descriptions, re-embed');
    console.log('   Cost: ~$0.001/item (Voyage-4 only, no LLM)\n');

    // Build query
    let query = (supabase.from('global_items') as any)
        .select(`
            id, title, description, description_parts, category_type, 
            external_ids, metadata, status, number_of_seasons, number_of_episodes,
            genres, keywords, cast, vote_average, last_rehydrated_at
        `)
        .in('category_type', ['TV_SHOW', 'TV'])
        .not('description_parts', 'is', null) // Must have cached descriptions
        .order('last_rehydrated_at', { ascending: true, nullsFirst: true });

    // Filter by status if specified
    if (options.status) {
        const statusMap: Record<string, string> = {
            'returning': 'Returning Series',
            'production': 'In Production',
            'ended': 'Ended',
            'canceled': 'Canceled'
        };
        const dbStatus = statusMap[options.status.toLowerCase()] || options.status;
        query = query.eq('status', dbStatus);
    }

    const { data: items, error } = await query.limit(options.limit || 100);

    if (error) {
        console.error('❌ Query error:', error);
        return stats;
    }

    console.log(`📊 Found ${items?.length || 0} TV shows to evaluate\n`);
    if (!items || items.length === 0) return stats;

    for (const item of items) {
        stats.processed++;

        try {
            const tmdbId = item.external_ids?.tmdb_tv || item.external_ids?.tmdb;
            if (!tmdbId) {
                console.log(`   [${stats.processed}/${items.length}] ${item.title} - ⏭️ No TMDB ID`);
                stats.skipped++;
                continue;
            }

            // Check staleness (unless force mode)
            if (!options.force && options.staleOnly !== false && !isStale(item)) {
                console.log(`   [${stats.processed}/${items.length}] ${item.title} - ⏭️ Not stale yet`);
                stats.skipped++;
                continue;
            }

            console.log(`   [${stats.processed}/${items.length}] ${item.title}`);

            if (options.dryRun) {
                console.log(`      ⏭️ DRY RUN - Would rehydrate`);
                stats.skipped++;
                continue;
            }

            // 1. Fetch fresh TMDB data
            const fresh = await fetchFreshTmdbData(tmdbId);
            if (!fresh) {
                console.log(`      ⚠️ Failed to fetch TMDB data`);
                stats.failed++;
                continue;
            }

            // 2. Check for season count change (immediate trigger)
            const oldSeasons = item.number_of_seasons || 0;
            const newSeasons = fresh.number_of_seasons || 0;
            const seasonChanged = newSeasons > oldSeasons;

            if (options.detectNewSeasons && !seasonChanged) {
                console.log(`      ⏭️ No new seasons (${oldSeasons} → ${newSeasons})`);
                stats.skipped++;
                continue;
            }

            // 3. Build updates object
            const updates: Record<string, any> = {
                number_of_seasons: fresh.number_of_seasons,
                number_of_episodes: fresh.number_of_episodes,
                status: fresh.status,
                vote_average: fresh.vote_average,
                last_rehydrated_at: new Date().toISOString()
            };

            // Set rehydration priority based on status
            updates.rehydration_priority =
                fresh.status === 'Returning Series' ? 'weekly' :
                    fresh.status === 'In Production' ? 'monthly' :
                        'quarterly';

            // Update metadata with fresh data
            updates.metadata = {
                ...item.metadata,
                last_air_date: fresh.last_air_date,
                next_episode_to_air: fresh.next_episode_to_air,
                networks: fresh.networks?.map((n: any) => n.name) || item.metadata?.networks
            };

            // 4. Build embedding text using CACHED description_parts + FRESH stats
            const embeddingText = buildTvShowEmbeddingText({
                title: item.title,
                category_type: item.category_type,
                description_parts: item.description_parts, // CACHED - no LLM call!
                genres: item.genres || fresh.genres?.map((g: any) => g.name),
                cast: item.cast,
                keywords: item.keywords,
                metadata: {
                    ...updates.metadata,
                    number_of_seasons: fresh.number_of_seasons,
                    number_of_episodes: fresh.number_of_episodes,
                    status: fresh.status,
                    vote_average: fresh.vote_average
                }
            });

            // 5. Generate new embedding (Voyage-4 only, ~$0.001)
            const embedding = await generateEmbedding(embeddingText);
            if (embedding) {
                updates.embedding = embedding;
            }

            // 6. Update database
            await (supabase.from('global_items') as any)
                .update(updates)
                .eq('id', item.id);

            const changes = [];
            if (seasonChanged) changes.push(`seasons: ${oldSeasons}→${newSeasons}`);
            if (fresh.status !== item.status) changes.push(`status: ${fresh.status}`);

            console.log(`      ✅ Rehydrated${changes.length ? ` (${changes.join(', ')})` : ''}`);
            stats.updated++;

        } catch (error: any) {
            console.log(`      ❌ Error: ${error.message}`);
            stats.failed++;
        }

        await sleep(DELAY_BETWEEN_ITEMS);
    }

    return stats;
}
