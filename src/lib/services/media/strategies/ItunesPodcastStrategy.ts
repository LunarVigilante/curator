import { MediaStrategy, MediaSearchResponse } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';

/**
 * Enhanced iTunes Podcast Strategy
 * 
 * iTunes (Apple Podcasts) is the "Source of Truth" for the podcasting industry.
 * 
 * IMPORTANT NOTES:
 * - Default Search API returns truncated descriptions
 * - Use Lookup API (/lookup) for full metadata when user selects
 * - feedUrl is THE GOLD - allows future RSS parsing for episode titles
 * - Podcasts are personality-driven; the Network defines the style
 * 
 * Network Vibes:
 * - Wondery = High production, sound design, true crime
 * - NPR = Informative, calm, journalistic
 * - Barstool = Conversational, rowdy, sports
 * - iHeartRadio = Wide variety, commercialized
 * - Gimlet/Spotify = Narrative, storytelling
 */
export class ItunesPodcastStrategy implements MediaStrategy {
    name = "iTunes Podcasts";
    description = "Search for podcasts using iTunes API with network vibe and genre metadata";

    /**
     * Fetch detailed podcast info using Lookup API
     */
    private async fetchPodcastDetails(collectionId: number, apiUrl: string): Promise<{
        feedUrl: string;
        genres: string[];
        contentAdvisoryRating: string;
        collectionExplicitness: string;
        country: string;
        description: string;
    }> {
        try {
            const response = await fetch(`${apiUrl}/lookup?id=${collectionId}&entity=podcast`);

            if (!response.ok) {
                return this.getDefaultDetails();
            }

            const data = await response.json();
            const pod = data.results?.[0];

            if (!pod) {
                return this.getDefaultDetails();
            }

            return {
                feedUrl: pod.feedUrl || '',
                genres: pod.genreIds ? [] : (pod.genres || []), // genres is an array of strings
                contentAdvisoryRating: pod.contentAdvisoryRating || '',
                collectionExplicitness: pod.collectionExplicitness || 'notExplicit',
                country: pod.country || 'US',
                description: pod.description || ''
            };
        } catch (error) {
            console.error("Failed to fetch podcast details:", error);
            return this.getDefaultDetails();
        }
    }

    private getDefaultDetails() {
        return {
            feedUrl: '',
            genres: [],
            contentAdvisoryRating: '',
            collectionExplicitness: 'notExplicit',
            country: 'US',
            description: ''
        };
    }

    /**
     * Detect network vibe category based on artist/network name
     */
    private getNetworkVibe(artistName: string): string {
        const artistLower = artistName.toLowerCase();

        // Premium Narrative Networks
        if (/wondery/.test(artistLower)) return 'Wondery (High Production)';
        if (/gimlet|spotify studios/.test(artistLower)) return 'Gimlet/Spotify (Narrative)';
        if (/serial|this american life/.test(artistLower)) return 'Serial Productions';
        if (/radiotopia|prx/.test(artistLower)) return 'Radiotopia (Indie)';

        // News/Information Networks
        if (/npr|national public radio/.test(artistLower)) return 'NPR (Journalistic)';
        if (/bbc/.test(artistLower)) return 'BBC (British)';
        if (/new york times|nyt/.test(artistLower)) return 'NYT (News)';
        if (/washington post|wapo/.test(artistLower)) return 'WaPo (News)';
        if (/vox/.test(artistLower)) return 'Vox (Explainer)';
        if (/cnn/.test(artistLower)) return 'CNN (News)';

        // Entertainment Networks
        if (/barstool/.test(artistLower)) return 'Barstool (Sports/Comedy)';
        if (/iheartradio|iheart/.test(artistLower)) return 'iHeartRadio (Commercial)';
        if (/earwolf/.test(artistLower)) return 'Earwolf (Comedy)';
        if (/parcast/.test(artistLower)) return 'Parcast (True Crime)';
        if (/ringer/.test(artistLower)) return 'The Ringer (Sports/Culture)';
        if (/crooked media/.test(artistLower)) return 'Crooked Media (Politics)';
        if (/headgum/.test(artistLower)) return 'HeadGum (Comedy)';

        // Tech Networks
        if (/relay fm/.test(artistLower)) return 'Relay FM (Tech)';
        if (/twit|this week in tech/.test(artistLower)) return 'TWiT (Tech)';

        return 'Independent';
    }

    /**
     * Get podcast format based on episode count
     */
    private getPodcastFormat(episodeCount: number): string {
        if (episodeCount === 0) return 'Unknown';
        if (episodeCount <= 10) return 'Limited Series';
        if (episodeCount <= 30) return 'Seasonal';
        if (episodeCount <= 100) return 'Regular';
        if (episodeCount <= 300) return 'Long-Running';
        return 'Legacy Show';
    }

    /**
     * Clean up genre list (iTunes sometimes includes IDs)
     */
    private cleanGenres(genres: string[]): string[] {
        return genres.filter(g => typeof g === 'string' && !/^\d+$/.test(g));
    }

    async search(query: string, settings: SystemSettings): Promise<MediaSearchResponse> {
        const apiUrl = settings['itunes_api_url'] || 'https://itunes.apple.com';

        // iTunes Public API - No Key Required
        try {
            const response = await fetch(`${apiUrl}/search?term=${encodeURIComponent(query)}&entity=podcast&limit=5`);
            if (!response.ok) return { success: false, data: [], error: `iTunes Error: ${response.statusText}` };

            const data = await response.json();
            if (!data.results) return { success: true, data: [] };

            // Process podcasts with enhanced metadata (parallel fetching)
            const resultsPromises = data.results.slice(0, 5).map(async (item: any) => {
                const year = item.releaseDate ? item.releaseDate.substring(0, 4) : undefined;

                // Fetch detailed lookup info
                const details = await this.fetchPodcastDetails(item.collectionId, apiUrl);

                // Get network vibe
                const networkVibe = this.getNetworkVibe(item.artistName || '');

                // Get podcast format
                const podcastFormat = this.getPodcastFormat(item.trackCount || 0);

                // Clean genres
                const allGenres = this.cleanGenres([
                    item.primaryGenreName,
                    ...(details.genres || [])
                ].filter(Boolean));

                // Is explicit?
                const isExplicit = details.collectionExplicitness === 'explicit' ||
                    details.contentAdvisoryRating === 'Explicit';

                // Build description
                const descParts: string[] = [];
                if (item.artistName) descParts.push(`by ${item.artistName}`);
                if (item.primaryGenreName) descParts.push(item.primaryGenreName);
                if (item.trackCount) descParts.push(`${item.trackCount} eps`);
                if (isExplicit) descParts.push('🔞');

                // Build AI analysis payload
                const analysisPayload = `Type: Podcast. Title: ${item.collectionName}. Host/Network: ${item.artistName}. Primary Genre: ${item.primaryGenreName}. All Genres: ${allGenres.join(", ")}. Episode Count: ${item.trackCount}. Rating: ${details.contentAdvisoryRating || "Not Rated"}. Network Vibe: ${networkVibe}. Format: ${podcastFormat}.`;

                return {
                    id: `itunes-${item.collectionId}`,
                    type: 'podcast',
                    title: item.collectionName || item.trackName,
                    description: descParts.join(' • ') || `Hosted by ${item.artistName}`,
                    imageUrl: item.artworkUrl600 || item.artworkUrl100,
                    year: year,
                    tags: allGenres.slice(0, 5),
                    metadata: JSON.stringify({
                        itunesId: item.collectionId,
                        type: 'podcast',
                        // Host/Network (THE ranking factor)
                        artistName: item.artistName,
                        networkVibe: networkVibe,
                        // Genres
                        primaryGenre: item.primaryGenreName,
                        genres: allGenres,
                        // Episode Info
                        trackCount: item.trackCount,
                        podcastFormat: podcastFormat,
                        // Content Rating
                        contentAdvisoryRating: details.contentAdvisoryRating,
                        collectionExplicitness: details.collectionExplicitness,
                        isExplicit: isExplicit,
                        // Feed URL (THE GOLD - allows RSS parsing)
                        feedUrl: details.feedUrl,
                        // Dates
                        releaseDate: item.releaseDate,
                        // Country
                        country: details.country,
                        // Links
                        collectionViewUrl: item.collectionViewUrl,
                        feedViewUrl: item.feedViewUrl,
                        // Description (often truncated in search)
                        description: details.description || '',
                        // AI Analysis Payload
                        analysisPayload: analysisPayload
                    })
                };
            });

            const results = await Promise.all(resultsPromises);

            return { success: true, data: results };
        } catch (error) {
            console.error("iTunes Podcast search failed:", error);
            return { success: false, data: [], error: "iTunes Unreachable" };
        }
    }
}
