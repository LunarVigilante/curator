
import { MediaStrategy, MediaSearchResponse, MediaResult } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';
import { ComicVineStrategy } from "./ComicVineStrategy";
import { GoogleBooksStrategy } from "./GoogleBooksStrategy";

/**
 * ComicFetcherService
 * 
 * A robust "meta-strategy" that implements a Waterfall Fallback pattern 
 * for retrieving Comic Book metadata.
 * 
 * Priority:
 * 1. ComicVine (Best data, but strict rate limits/403s)
 * 2. Metron (Alternate DB)
 * 3. Google Books (Last resort)
 */
export class ComicFetcherService implements MediaStrategy {
    name = "Comics";
    description = "Smart fallback strategy: ComicVine -> Metron -> Google Books";

    // Strategies
    private comicVineStrategy = new ComicVineStrategy();
    private googleBooksStrategy = new GoogleBooksStrategy();

    // Helper: Pause for rate limits / race conditions
    private async delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async search(query: string, settings: SystemSettings): Promise<MediaSearchResponse> {
        console.log(`[ComicFetcher] Starting waterfall search for: "${query}"`);

        // --- ATTEMPT 1: COMIC VINE ---
        try {
            console.log('[ComicFetcher] Attempt 1: ComicVine');
            const cvResponse = await this.comicVineStrategy.search(query, settings);
            if (cvResponse.success && cvResponse.data.length > 0) {
                console.log(`[ComicFetcher] ComicVine success! Found ${cvResponse.data.length} items.`);
                return cvResponse;
            }
            if (cvResponse.error) {
                console.warn('[ComicFetcher] ComicVine failed:', cvResponse.error);
            }
        } catch (err) {
            console.warn('[ComicFetcher] ComicVine exception:', err);
        }

        await this.delay(200);

        // --- ATTEMPT 2: METRON ---
        const metronUser = settings['metron_username'];
        const metronPass = settings['metron_password'];

        if (metronUser && metronPass) {
            try {
                console.log('[ComicFetcher] Attempt 2: Metron');
                const metronResponse = await this.searchMetron(query, metronUser, metronPass);
                if (metronResponse.length > 0) {
                    return { success: true, data: metronResponse };
                }
            } catch (err) {
                console.warn('[ComicFetcher] Metron exception:', err);
            }
            await this.delay(200);
        }

        // --- ATTEMPT 3: GOOGLE BOOKS (Last Resort) ---
        try {
            console.log('[ComicFetcher] Attempt 3: Google Books (Last Resort)');
            // Force "comics" context into the query if not present
            const gbQuery = query.toLowerCase().includes('comic') ? query : `${query} comic graphic novel`;
            // GoogleBooksStrategy.search only takes 2 args in implementation
            const gbResponse = await this.googleBooksStrategy.search(gbQuery, settings);

            if (gbResponse.success) {
                // Return whatever Google Books found, mapped to 'comic' type if possible
                return {
                    success: true,
                    data: gbResponse.data.map(item => ({
                        ...item,
                        type: 'comic', // Force type to comic for consistency
                        description: `[From Google Books] ${item.description}`
                    }))
                };
            }
        } catch (err) {
            console.warn('[ComicFetcher] Google Books exception:', err);
        }

        return { success: false, data: [], error: "All comic providers failed." };
    }

    // =========================================================================
    // PROVIDER 2: METRON
    // =========================================================================
    private async searchMetron(query: string, username: string, password: string): Promise<MediaResult[]> {
        const headers = {
            'Authorization': 'Basic ' + Buffer.from(username + ":" + password).toString('base64')
        };

        const url = `https://metron.cloud/api/series/?name=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers });

        if (!res.ok) throw new Error(`Metron status: ${res.status}`);

        const data = await res.json();
        const results = data.results || [];

        return results.map((item: any) => ({
            id: `metron-${item.id}`,
            type: 'comic',
            title: item.name,
            description: `Published by ${item.publisher?.name || 'Unknown'}. ${item.desc || ''}`,
            imageUrl: null, // Metron often requires separate image calls
            year: item.year_began?.toString(),
            metadata: {
                publisher: item.publisher?.name,
                metronId: item.id,
                issue_count: item.issue_count
            }
        }));
    }
}
