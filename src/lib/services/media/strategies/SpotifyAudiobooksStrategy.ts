import { MediaStrategy, MediaSearchResponse } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';

/**
 * Enhanced Spotify Audiobooks Strategy
 * 
 * CRITICAL for Audiobook Listeners:
 * - Narrators are followed as loyally as authors (e.g., Ray Porter, Julia Whelan)
 * - "Abridged" is considered F-Tier compared to "Unabridged"
 * - Must use market=US parameter or Spotify returns 404 for region-locked content
 * 
 * Metadata captured:
 * - Authors (the writer)
 * - Narrators (the voice - CRITICAL for recommendations)
 * - Edition (Unabridged vs Abridged)
 * - Languages, Publisher, Explicit flag
 */
export class SpotifyAudiobooksStrategy implements MediaStrategy {
    name = "Spotify Audiobooks";
    description = "Search for audiobooks using Spotify API with narrator and edition metadata";

    // Default market (required for audiobooks API)
    private market = 'US';

    // Share token caching with main Spotify strategy
    private static accessToken: string | null = null;
    private static tokenExpiresAt: number = 0;

    private async getSpotifyToken(settings: SystemSettings): Promise<string> {
        // Check if token is valid (with 5 min buffer)
        if (SpotifyAudiobooksStrategy.accessToken && Date.now() < SpotifyAudiobooksStrategy.tokenExpiresAt - 300000) {
            return SpotifyAudiobooksStrategy.accessToken;
        }

        const clientId = settings['spotify_client_id'];
        const clientSecret = settings['spotify_client_secret'];

        if (!clientId || !clientSecret) {
            throw new Error("Missing Spotify Client ID or Secret in settings");
        }

        try {
            const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Spotify Auth Failed: ${error.error_description || response.statusText}`);
            }

            const data = await response.json();

            SpotifyAudiobooksStrategy.accessToken = data.access_token;
            SpotifyAudiobooksStrategy.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

            return data.access_token;

        } catch (error) {
            console.error("Spotify Token Error:", error);
            throw error;
        }
    }

    /**
     * Fetch full audiobook details with market parameter
     * IMPORTANT: market is required or Spotify returns 404
     */
    private async fetchAudiobookDetails(token: string, audiobookId: string, apiUrl: string): Promise<{
        narrators: string[];
        edition: string;
        publisher: string;
        languages: string[];
        explicit: boolean;
        totalChapters: number;
        htmlDescription: string;
        description: string;
    }> {
        try {
            // CRITICAL: Include market parameter
            const response = await fetch(`${apiUrl}/audiobooks/${audiobookId}?market=${this.market}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                console.warn(`Failed to fetch audiobook ${audiobookId}: ${response.status}`);
                return this.getDefaultDetails();
            }

            const book = await response.json();

            return {
                narrators: book.narrators?.map((n: any) => n.name) || [],
                edition: book.edition || '',
                publisher: book.publisher || '',
                languages: book.languages || [],
                explicit: book.explicit || false,
                totalChapters: book.total_chapters || 0,
                htmlDescription: book.html_description || '',
                description: book.description || ''
            };
        } catch (error) {
            console.error("Failed to fetch audiobook details:", error);
            return this.getDefaultDetails();
        }
    }

    private getDefaultDetails() {
        return {
            narrators: [],
            edition: '',
            publisher: '',
            languages: [],
            explicit: false,
            totalChapters: 0,
            htmlDescription: '',
            description: ''
        };
    }

    /**
     * Clean HTML description to plain text
     */
    private cleanHtmlDescription(html: string): string {
        return html
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<p>/gi, ' ')
            .replace(/<\/p>/gi, ' ')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async search(query: string, settings: SystemSettings): Promise<MediaSearchResponse> {
        try {
            const token = await this.getSpotifyToken(settings);
            const apiUrl = settings['spotify_api_url'] || 'https://api.spotify.com/v1';

            // Search for audiobooks with market parameter
            const response = await fetch(
                `${apiUrl}/search?q=${encodeURIComponent(query)}&type=audiobook&limit=5&market=${this.market}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) {
                // Audiobooks API might not be available in all markets
                if (response.status === 404 || response.status === 400) {
                    return {
                        success: false,
                        data: [],
                        error: 'Audiobooks not available in your region'
                    };
                }
                return { success: false, data: [], error: `Spotify Error: ${response.statusText}` };
            }

            const data = await response.json();

            if (!data.audiobooks || !data.audiobooks.items) {
                return { success: true, data: [] };
            }

            // Process audiobooks with enhanced metadata (parallel fetching)
            const resultsPromises = data.audiobooks.items.slice(0, 5).map(async (item: any) => {
                const image = item.images && item.images.length > 0 ? item.images[0].url : null;
                const authorsList = item.authors?.map((a: any) => a.name) || [];
                const authorsDisplay = authorsList.join(', ');

                // Fetch detailed audiobook info with market parameter
                const details = await this.fetchAudiobookDetails(token, item.id, apiUrl);

                // Clean description
                const plainDescription = details.htmlDescription
                    ? this.cleanHtmlDescription(details.htmlDescription)
                    : (details.description || item.description || '');

                // Build display description
                const descParts: string[] = [];
                if (authorsDisplay) descParts.push(`by ${authorsDisplay}`);
                if (details.narrators.length > 0) {
                    descParts.push(`Narrated by ${details.narrators.slice(0, 2).join(', ')}`);
                }
                if (details.edition) {
                    const editionLabel = details.edition.toLowerCase().includes('abridged')
                        && !details.edition.toLowerCase().includes('unabridged')
                        ? `⚠️ ${details.edition}` // Warn about abridged
                        : `✓ ${details.edition}`;
                    descParts.push(editionLabel);
                }

                // Detect edition quality
                const isUnabridged = details.edition?.toLowerCase().includes('unabridged') ||
                    (!details.edition?.toLowerCase().includes('abridged') && details.edition !== '');
                const isAbridged = details.edition?.toLowerCase().includes('abridged') &&
                    !details.edition?.toLowerCase().includes('unabridged');

                // Build AI Analysis Payload - CRITICAL: Separate Author from Narrator
                const analysisPayload = `Type: Audiobook. Title: ${item.name}. Author: ${authorsList.join(", ")}. Narrator: ${details.narrators.join(", ")}. Edition: ${details.edition || "Unabridged"}. Publisher: ${details.publisher}. Description: ${plainDescription.substring(0, 500)}. Explicit: ${details.explicit}.`;

                return {
                    id: `spotify-audiobook-${item.id}`,
                    type: 'audiobook',
                    title: item.name,
                    description: descParts.join(' • ') || plainDescription.substring(0, 150),
                    imageUrl: image,
                    year: undefined, // Audiobooks don't have a standard year field
                    tags: details.narrators.slice(0, 3), // Use narrators as tags for discoverability
                    metadata: JSON.stringify({
                        spotifyId: item.id,
                        type: 'audiobook',
                        url: item.external_urls?.spotify,
                        // Authors (The Writer)
                        authors: authorsDisplay,
                        authorsList: authorsList,
                        // Narrators (The Voice) - CRITICAL for recommendations
                        narrators: details.narrators,
                        // Edition Quality
                        edition: details.edition,
                        isUnabridged: isUnabridged,
                        isAbridged: isAbridged,
                        editionQuality: isAbridged ? 'low' : 'high',
                        // Content Info
                        publisher: details.publisher,
                        languages: details.languages,
                        explicit: details.explicit,
                        totalChapters: details.totalChapters,
                        // Description (plain text for vectors)
                        description: plainDescription.substring(0, 1000),
                        htmlDescription: details.htmlDescription,
                        // AI Analysis Payload
                        analysisPayload: analysisPayload
                    })
                };
            });

            const results = await Promise.all(resultsPromises);

            return { success: true, data: results };

        } catch (error: any) {
            console.error("Spotify Audiobooks search failed:", error);
            const isConfigError = error.message?.includes('Missing Spotify');
            return {
                success: false,
                data: [],
                error: isConfigError ? 'Spotify settings missing' : 'Spotify Audiobooks unreachable'
            };
        }
    }
}
