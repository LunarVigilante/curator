/**
 * Franchise Detection Service
 * 
 * Detects universe membership and parent/spinoff relationships
 * using TMDB keywords and known spinoff mappings.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { detectUniverseFromKeywords, KNOWN_SPINOFFS } from '@/lib/constants/franchise-keywords';

// =============================================================================
// UNIVERSE DETECTION
// =============================================================================

/**
 * Look up a universe by slug and return its UUID
 */
export async function lookupUniverseId(
    supabase: ReturnType<typeof createServiceRoleClient>,
    slug: string
): Promise<string | null> {
    const { data, error: _error } = await supabase
        .from('tv_universes')
        .select('id')
        .eq('slug', slug)
        .single();

    if (_error || !data) return null;
    return data.id;
}

/**
 * Detect universe from TMDB keywords and resolve to UUID
 * 
 * @param supabase - Supabase client
 * @param keywords - Array of TMDB keywords (id + name)
 * @returns Universe ID and slug, or null if no match
 */
export async function detectAndResolveUniverse(
    supabase: ReturnType<typeof createServiceRoleClient>,
    keywords?: { id: number; name: string }[]
): Promise<{ universeId: string; slug: string } | null> {
    if (!keywords || keywords.length === 0) return null;

    const keywordIds = keywords.map(k => k.id);
    const match = detectUniverseFromKeywords(keywordIds);

    if (!match) return null;

    const universeId = await lookupUniverseId(supabase, match.slug);
    if (!universeId) return null;

    return { universeId, slug: match.slug };
}

// =============================================================================
// PARENT/SPINOFF DETECTION
// =============================================================================

/**
 * Detect parent series from known spinoffs list
 * 
 * @param supabase - Supabase client
 * @param tmdbId - TMDB ID of potential spinoff
 * @returns Parent item UUID or null
 */
export async function detectParentSeries(
    supabase: ReturnType<typeof createServiceRoleClient>,
    tmdbId: number
): Promise<string | null> {
    const spinoff = KNOWN_SPINOFFS.find(([childId]) => childId === tmdbId);
    if (!spinoff) return null;

    const [, parentTmdbId] = spinoff;

    // Look up parent by TMDB ID
    const { data } = await supabase
        .from('global_items')
        .select('id')
        .eq('category_type', 'TV_SHOW')
        .contains('external_ids', { tmdb: parentTmdbId })
        .single();

    return data?.id || null;
}
