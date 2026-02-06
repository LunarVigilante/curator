/**
 * Wikidata Federation Service
 * 
 * Queries Wikidata SPARQL endpoint to discover franchise/universe relationships
 * not available in TMDB metadata.
 * 
 * Key Properties:
 * - P179: "part of the series" (e.g., GoT is part of ASOIAF)
 * - P140: "narrative universe" (e.g., Flash is part of Arrowverse)
 * - P144: "based on" (source material)
 * - P8345: "spinoff of"
 * - P345: "IMDb ID"
 * - P4983: "TMDB TV series ID"
 */

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'Curator/1.0 (https://github.com/LunarVigilante/curator)';

// Rate limit: Wikidata allows ~60 requests per minute for anonymous users
const RATE_LIMIT_MS = 1000; // 1 second between requests
let lastRequestTime = 0;

// Fail-open configuration
const WIKIDATA_TIMEOUT_MS = 3000; // 3 second timeout (Wikidata can be slow)
const NEGATIVE_CACHE_DAYS = 30;

// In-memory negative result cache: { qid -> timestamp }
// Prevents repeated queries for entities with no universe data
const negativeCache = new Map<string, number>();

// =============================================================================
// CIRCUIT BREAKER (v4.4 - Refactored to use CircuitBreaker class)
// Prevents harvest hang during Wikidata outages
// =============================================================================
import { CircuitBreaker } from '@/lib/utils/circuit-breaker';

const CIRCUIT_FAILURE_THRESHOLD = 5;      // Open circuit after 5 consecutive failures
const CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minute cooldown before retry

// Reusable circuit breaker instance for Wikidata service
const wikidataCircuit = new CircuitBreaker(CIRCUIT_FAILURE_THRESHOLD, CIRCUIT_COOLDOWN_MS);


export interface WikidataRelationships {
    partOfSeries: string | null;      // P179: Q-ID of parent series
    partOfSeriesLabel: string | null; // Human-readable label
    narrativeUniverse: string | null; // P140: Q-ID of narrative universe
    narrativeUniverseLabel: string | null;
    basedOn: string | null;           // P144: Q-ID of source material
    basedOnLabel: string | null;
    spinoffOf: string | null;         // P8345: Q-ID of parent show
    spinoffOfLabel: string | null;
    imdbId: string | null;            // P345
    tmdbId: string | null;            // P4983
}

/**
 * Execute a SPARQL query against Wikidata with timeout and circuit breaker
 */
async function executeSparqlQuery(query: string): Promise<any> {
    // CIRCUIT BREAKER CHECK (v4.4 - Refactored)
    // Skip all requests while circuit is open
    if (wikidataCircuit.isOpen()) {
        const remainingMs = wikidataCircuit.getRemainingCooldown();
        console.warn(`[Wikidata] Circuit OPEN - skipping (${Math.round(remainingMs / 1000)}s remaining)`);
        throw new Error('Circuit breaker open');
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`;

    // Add timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WIKIDATA_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/sparql-results+json',
                'User-Agent': USER_AGENT,
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Wikidata] SPARQL query failed: ${response.status}`, errorText);
            throw new Error(`Wikidata SPARQL query failed: ${response.status}`);
        }

        // SUCCESS: Reset circuit breaker
        wikidataCircuit.recordSuccess();
        return response.json();
    } catch (error) {
        clearTimeout(timeoutId);

        // CIRCUIT BREAKER: Track consecutive failures
        wikidataCircuit.recordFailure();

        if (error instanceof Error && error.name === 'AbortError') {
            console.warn(`[Wikidata] Query timed out after ${WIKIDATA_TIMEOUT_MS}ms (failure ${wikidataCircuit.getFailureCount()}/${CIRCUIT_FAILURE_THRESHOLD})`);
        }
        throw error;
    }
}

/**
 * Fetch franchise/universe relationships for a Wikidata entity
 * 
 * @param wikidataId - Wikidata Q-ID (e.g., "Q161617" for Breaking Bad)
 * @returns Relationship data from Wikidata properties
 */
export async function fetchWikidataRelationships(wikidataId: string): Promise<WikidataRelationships | null> {
    // Ensure Q-prefix
    const qid = wikidataId.startsWith('Q') ? wikidataId : `Q${wikidataId}`;

    // Check negative cache first - skip known-empty entities
    const cachedAt = negativeCache.get(qid);
    if (cachedAt && Date.now() - cachedAt < NEGATIVE_CACHE_DAYS * 86400000) {
        return null; // Skip - known to have no universe data
    }

    const query = `
        SELECT ?partOfSeries ?partOfSeriesLabel 
               ?narrativeUniverse ?narrativeUniverseLabel
               ?basedOn ?basedOnLabel
               ?spinoffOf ?spinoffOfLabel
               ?imdbId ?tmdbId
        WHERE {
            BIND(wd:${qid} AS ?item)
            
            OPTIONAL { ?item wdt:P179 ?partOfSeries. }
            OPTIONAL { ?item wdt:P140 ?narrativeUniverse. }
            OPTIONAL { ?item wdt:P144 ?basedOn. }
            OPTIONAL { ?item wdt:P8345 ?spinoffOf. }
            OPTIONAL { ?item wdt:P345 ?imdbId. }
            OPTIONAL { ?item wdt:P4983 ?tmdbId. }
            
            SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
        }
        LIMIT 1
    `;

    try {
        const result = await executeSparqlQuery(query);
        const bindings = result?.results?.bindings?.[0];

        if (!bindings) {
            console.log(`[Wikidata] No data found for ${qid} (caching negative result)`);
            // Cache negative result to avoid repeated queries
            negativeCache.set(qid, Date.now());
            return {
                partOfSeries: null,
                partOfSeriesLabel: null,
                narrativeUniverse: null,
                narrativeUniverseLabel: null,
                basedOn: null,
                basedOnLabel: null,
                spinoffOf: null,
                spinoffOfLabel: null,
                imdbId: null,
                tmdbId: null,
            };
        }

        // Extract Q-IDs from full URIs (e.g., "http://www.wikidata.org/entity/Q12345" -> "Q12345")
        const extractQid = (value: any): string | null => {
            if (!value?.value) return null;
            const match = value.value.match(/Q\d+$/);
            return match ? match[0] : null;
        };

        return {
            partOfSeries: extractQid(bindings.partOfSeries),
            partOfSeriesLabel: bindings.partOfSeriesLabel?.value || null,
            narrativeUniverse: extractQid(bindings.narrativeUniverse),
            narrativeUniverseLabel: bindings.narrativeUniverseLabel?.value || null,
            basedOn: extractQid(bindings.basedOn),
            basedOnLabel: bindings.basedOnLabel?.value || null,
            spinoffOf: extractQid(bindings.spinoffOf),
            spinoffOfLabel: bindings.spinoffOfLabel?.value || null,
            imdbId: bindings.imdbId?.value || null,
            tmdbId: bindings.tmdbId?.value || null,
        };
    } catch (error) {
        console.error(`[Wikidata] Error fetching relationships for ${qid}:`, error);
        return {
            partOfSeries: null,
            partOfSeriesLabel: null,
            narrativeUniverse: null,
            narrativeUniverseLabel: null,
            basedOn: null,
            basedOnLabel: null,
            spinoffOf: null,
            spinoffOfLabel: null,
            imdbId: null,
            tmdbId: null,
        };
    }
}

/**
 * Find TMDB ID for a Wikidata entity
 */
export async function resolveWikidataToTmdb(wikidataId: string): Promise<number | null> {
    const qid = wikidataId.startsWith('Q') ? wikidataId : `Q${wikidataId}`;

    const query = `
        SELECT ?tmdbId WHERE {
            wd:${qid} wdt:P4983 ?tmdbId.
        }
        LIMIT 1
    `;

    try {
        const result = await executeSparqlQuery(query);
        const tmdbId = result?.results?.bindings?.[0]?.tmdbId?.value;
        return tmdbId ? parseInt(tmdbId, 10) : null;
    } catch (error) {
        console.error(`[Wikidata] Error resolving TMDB ID for ${qid}:`, error);
        return null;
    }
}

/**
 * Find all TV shows in a narrative universe
 * 
 * @param universeQid - Wikidata Q-ID of the universe (e.g., "Q23880962" for Arrowverse)
 * @returns Array of TMDB IDs for shows in this universe
 */
export async function findShowsInUniverse(universeQid: string): Promise<number[]> {
    const qid = universeQid.startsWith('Q') ? universeQid : `Q${universeQid}`;

    const query = `
        SELECT ?show ?tmdbId WHERE {
            ?show wdt:P140 wd:${qid}.  # part of narrative universe
            ?show wdt:P31 wd:Q5398426.  # instance of television series
            ?show wdt:P4983 ?tmdbId.    # has TMDB ID
        }
    `;

    try {
        const result = await executeSparqlQuery(query);
        const bindings = result?.results?.bindings || [];

        return bindings
            .map((b: any) => parseInt(b.tmdbId?.value, 10))
            .filter((id: number) => !isNaN(id));
    } catch (error) {
        console.error(`[Wikidata] Error finding shows in universe ${qid}:`, error);
        return [];
    }
}

/**
 * Find all spinoffs of a TV show
 * 
 * @param showQid - Wikidata Q-ID of the parent show
 * @returns Array of TMDB IDs for spinoffs
 */
export async function findSpinoffs(showQid: string): Promise<number[]> {
    const qid = showQid.startsWith('Q') ? showQid : `Q${showQid}`;

    const query = `
        SELECT ?spinoff ?tmdbId WHERE {
            ?spinoff wdt:P8345 wd:${qid}.  # spinoff of parent show
            ?spinoff wdt:P4983 ?tmdbId.     # has TMDB ID
        }
    `;

    try {
        const result = await executeSparqlQuery(query);
        const bindings = result?.results?.bindings || [];

        return bindings
            .map((b: any) => parseInt(b.tmdbId?.value, 10))
            .filter((id: number) => !isNaN(id));
    } catch (error) {
        console.error(`[Wikidata] Error finding spinoffs for ${qid}:`, error);
        return [];
    }
}

/**
 * Wikidata Universe Mapping (v4.3 SSOT)
 * 
 * Reads from franchise_rules table where rule_type = 'wikidata'
 * Falls back to hardcoded map if DB unavailable
 */

import { createClient } from '@/lib/supabase/server';

// In-memory cache for DB-driven rules (refreshed on cold start)
let wikidataRulesCache: Map<string, string> | null = null;

// Fallback hardcoded map (used if DB unavailable)
const WIKIDATA_UNIVERSE_MAP_FALLBACK: Record<string, string> = {
    'Q23880962': 'arrowverse',
    'Q3138418': 'star-trek',
    'Q25191': 'walking-dead',
    'Q116054': 'game-of-thrones',
    'Q18152564': 'breaking-bad',
    'Q108988194': 'yellowstone-verse',
    'Q58035048': 'chicago-verse',
};

/**
 * Load Wikidata rules from database (cached)
 */
async function loadWikidataRules(): Promise<Map<string, string>> {
    if (wikidataRulesCache) return wikidataRulesCache;

    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('franchise_rules')
            .select('source_identifier, target_universe_slug')
            .eq('rule_type', 'wikidata');

        if (error || !data || data.length === 0) {
            console.warn('[Wikidata] Failed to load rules from DB, using fallback');
            wikidataRulesCache = new Map(Object.entries(WIKIDATA_UNIVERSE_MAP_FALLBACK));
        } else {
            wikidataRulesCache = new Map(
                data.map((r: { source_identifier: string; target_universe_slug: string }) =>
                    [r.source_identifier, r.target_universe_slug]
                )
            );
            console.log(`[Wikidata] Loaded ${wikidataRulesCache.size} universe rules from DB`);
        }
    } catch {
        console.warn('[Wikidata] DB error, using fallback map');
        wikidataRulesCache = new Map(Object.entries(WIKIDATA_UNIVERSE_MAP_FALLBACK));
    }

    return wikidataRulesCache;
}

/**
 * Resolve a Wikidata universe Q-ID to our internal slug
 * 
 * @param universeQid - Wikidata Q-ID (e.g., "Q23880962" or "23880962")
 * @returns Universe slug or null if not found
 */
export async function resolveWikidataUniverseSlug(universeQid: string | null): Promise<string | null> {
    if (!universeQid) return null;
    const qid = universeQid.startsWith('Q') ? universeQid : `Q${universeQid}`;
    const rules = await loadWikidataRules();
    return rules.get(qid) ?? null;
}

/**
 * Clear the Wikidata rules cache (for testing or manual refresh)
 */
export function clearWikidataRulesCache(): void {
    wikidataRulesCache = null;
}

// Legacy export for backwards compatibility (sync version uses fallback only)
export const WIKIDATA_UNIVERSE_MAP = WIKIDATA_UNIVERSE_MAP_FALLBACK;

