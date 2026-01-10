
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { decrypt } from '@/lib/encryption';
import stringSimilarity from 'string-similarity';

const SGDB_BASE_URL = 'https://www.steamgriddb.com/api/v2';

export class SteamGridDBService {
    private apiKey: string | null = null;
    private supabase = createServiceRoleClient();

    constructor() {
        this.apiKey = process.env.STEAMGRIDDB_API_KEY || null;
    }

    private async getApiKey(): Promise<string | null> {
        if (this.apiKey) return this.apiKey;

        const { data: settingsData } = await (this.supabase
            .from('system_settings') as any)
            .select('value')
            .eq('key', 'STEAMGRIDDB_API_KEY')
            .single();

        if (settingsData?.value) {
            this.apiKey = decrypt(settingsData.value);
            return this.apiKey;
        }

        return null; // No key found
    }

    private async fetch(endpoint: string): Promise<any> {
        const key = await this.getApiKey();
        if (!key) {
            // console.warn('⚠️ No SteamGridDB API Key found.');
            return null;
        }

        try {
            const res = await fetch(`${SGDB_BASE_URL}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${key}` }
            });

            if (res.status === 429) {
                console.warn('   ⚠️ SteamGridDB Rate Limit. Sleeping 2s...');
                await new Promise(r => setTimeout(r, 2000));
                return this.fetch(endpoint); // Retry once
            }

            if (!res.ok) {
                if (res.status === 404) return null;
                console.warn(`   ⚠️ SGDB Error ${res.status}: ${res.statusText}`);
                return null;
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await res.text();
                console.warn(`   ⚠️ SGDB Invalid Response (Not JSON): ${text.substring(0, 100)}...`);
                return null;
            }

            return await res.json();
        } catch (e) {
            console.error('   ❌ SGDB Fetch Error:', e);
            return null;
        }
    }

    /**
     * Normalizes a title for better comparison.
     * Removes special characters, case, and extra spaces.
     */
    private normalizeTitle(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^\w\s\d]/g, '') // Remove non-alphanumeric (except spaces)
            .replace(/\s+/g, ' ')       // Collapse spaces
            .trim();
    }

    private async getGameIdBySteam(steamAppId: number): Promise<number | null> {
        const data = await this.fetch(`/games/steam/${steamAppId}`);
        return data?.data?.id || null; // API returns single object in data
    }

    private async getGameIdByName(name: string): Promise<number | null> {
        const encoded = encodeURIComponent(name);
        const data = await this.fetch(`/search/autocomplete/${encoded}`);

        if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) {
            // Try sanitized fallback if not already sanitized
            const sanitized = this.normalizeTitle(name);
            if (sanitized !== name.toLowerCase().trim()) {
                const encodedSanitized = encodeURIComponent(sanitized);
                const retryData = await this.fetch(`/search/autocomplete/${encodedSanitized}`);
                if (retryData?.data && Array.isArray(retryData.data) && retryData.data.length > 0) {
                    return this.findBestFuzzyMatch(retryData.data, name);
                }
            }
            return null;
        }

        return this.findBestFuzzyMatch(data.data, name);
    }

    /**
     * Iterates through search results to find the best fuzzy match.
     */
    private findBestFuzzyMatch(results: any[], targetName: string): number | null {
        const normalizedTarget = this.normalizeTitle(targetName);
        let bestMatchId: number | null = null;
        let highestScore = 0;

        for (const result of results) {
            const resultName = result.name;
            const normalizedResult = this.normalizeTitle(resultName);

            // Exact containment check (handles "Railroad Tycoon II" vs "Railroad Tycoon II: Platinum")
            if (normalizedResult.includes(normalizedTarget) || normalizedTarget.includes(normalizedResult)) {
                // Boost score for containment, but prefer exact matches if possible
                // We'll treat this as a very high score
                const containmentScore = 0.95;
                if (containmentScore > highestScore) {
                    highestScore = containmentScore;
                    bestMatchId = result.id;
                }
            }

            // String Similarity Score
            const score = stringSimilarity.compareTwoStrings(normalizedTarget, normalizedResult);

            if (score > highestScore) {
                highestScore = score;
                bestMatchId = result.id;
            }
        }

        // Threshold check
        if (highestScore > 0.4) {
            // console.log(`   ✨ Fuzzy Match: "${targetName}" ~= ID ${bestMatchId} (Score: ${highestScore.toFixed(2)})`);
            return bestMatchId;
        }

        return null;
    }

    private async getGrids(gameId: number): Promise<string | null> {
        // Fetch grids with desired dimensions
        // Priority: 600x900 (Vertical) > 920x430 (Hero/Banner) > 460x215 (Small Capsule)
        // We fetch all at once to minimize requests
        const data = await this.fetch(`/grids/game/${gameId}?dimensions=600x900,920x430,460x215&styles=alternate,material,blurred,no_logo&sort=score`);

        if (!data?.data || data.data.length === 0) {
            // Fallback: Try looser search if strict failed
            const looseData = await this.fetch(`/grids/game/${gameId}?dimensions=600x900,920x430,460x215&sort=score`);
            if (!looseData?.data || looseData.data.length === 0) return null;
            return this.selectBestGrid(looseData.data);
        }

        return this.selectBestGrid(data.data);
    }

    private selectBestGrid(grids: any[]): string | null {
        // Filter for Vertical 600x900 first
        const verticals = grids.filter((g: any) => g.width === 600 && g.height === 900);
        if (verticals.length > 0) return verticals[0].url; // Already sorted by score API-side

        // Fallback: Horizontal/Other if purely necessary, but user requested vertical posters.
        // If we strictly only want vertical, return null here. 
        // User prompt validation: "replace their cover images with high-resolution vertical posters".
        // BUT "Fallback: If no vertical, try Horizontal...".

        const horizontals = grids.filter((g: any) => (g.width === 920 && g.height === 430) || (g.width === 460 && g.height === 215));
        if (horizontals.length > 0) return horizontals[0].url;

        // Last resort: just take the top result if we have anything
        if (grids.length > 0) return grids[0].url;

        return null;
    }

    /**
     * Main Entry Point
     */
    static async getBestCoverArt(gameName: string, steamAppId?: number): Promise<string | null> {
        const service = new SteamGridDBService();
        return service.getBestCoverArtInstance(gameName, steamAppId);
    }

    // Instance method to allow proper `this` access without recreating service internally repeatedly if already instanced
    async getBestCoverArtInstance(gameName: string, steamAppId?: number): Promise<string | null> {
        // Wait for key
        const key = await this.getApiKey();
        if (!key) {
            // console.warn('Skipping SteamGridDB search: No API Key');
            return null;
        }

        let gameId: number | null = null;

        // Attempt 1: Steam ID
        if (steamAppId) {
            try {
                gameId = await this.updateGameIdIfFound(async () => this.getGameIdBySteam(steamAppId));
            } catch {
                // Steam ID lookup failed
            }
        }

        // Attempt 2: Name Search
        if (!gameId) {
            gameId = await this.updateGameIdIfFound(async () => this.getGameIdByName(gameName));
        }

        if (gameId) {
            return await this.getGrids(gameId);
        }

        return null;
    }

    private async updateGameIdIfFound(fn: () => Promise<number | null>): Promise<number | null> {
        const result = await fn();
        return result;
    }
}
