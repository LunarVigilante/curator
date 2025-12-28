import { MediaStrategy, MediaSearchResponse } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';

/**
 * Enhanced RAWG Strategy for Video Games
 * 
 * IMPORTANT: RAWG data is crowdsourced and can be messy.
 * - Tags include noise like "Steam", "Epic Games Store", "Achievements"
 * - Must filter to keep only descriptive tags
 * - Developer is key for "vibe" matching, not Publisher
 * 
 * Fetches comprehensive game metadata:
 * 1. Search → Get initial game list
 * 2. Fetch game details → Get tags, developers, publishers, ESRB rating
 */
export class RawgStrategy implements MediaStrategy {
    name = "Video Games";
    description = "Search for video games using RAWG API with enhanced metadata";

    /**
     * Blocklist of noisy RAWG tags that don't add value for recommendations
     * These are utility/store tags, not descriptive gameplay tags
     */
    private static readonly BLOCKED_TAGS = [
        // Store/Platform tags
        'Steam', 'Epic Games Store', 'GOG', 'PlayStation Store', 'Xbox Store',
        'Origin', 'Uplay', 'Battle.net', 'itch.io',
        // Utility tags
        'Singleplayer', 'Single Player', 'Multiplayer', 'Multi-Player',
        'Full controller support', 'Controller Support', 'Controller',
        'Achievements', 'Steam Achievements', 'Cloud Saves', 'Steam Cloud',
        'Steam Trading Cards', 'Trading Cards', 'Leaderboards',
        'Library', 'VR', 'VR Support', 'Remote Play',
        'Online Co-Op', 'Local Co-Op', 'Co-Op', 'Co-op',
        'PvP', 'PvE', 'Competitive', 'Casual',
        // Generic tags
        'Great Soundtrack', 'Soundtrack', 'Moddable', 'Mods',
        'First-Person', 'Third-Person', 'Third Person', '2D', '3D',
        'Female Protagonist', 'Male Protagonist', 'Choose Your Gender',
        'Early Access'
    ];

    /**
     * Fetch detailed game info for enhanced metadata
     */
    private async fetchGameDetails(apiKey: string, gameId: number, apiUrl: string): Promise<{
        allTags: Array<{ name: string; language?: string }>;
        developers: string[];
        publishers: string[];
        esrbRating: string | null;
        description: string;
        website: string | null;
        redditUrl: string | null;
        playtime: number;
        parentPlatforms: string[];
    }> {
        try {
            const response = await fetch(`${apiUrl}/games/${gameId}?key=${apiKey}`);

            if (!response.ok) {
                console.warn(`Failed to fetch game details for ${gameId}`);
                return this.getDefaultDetails();
            }

            const game = await response.json();

            return {
                allTags: game.tags || [],
                developers: game.developers?.map((d: any) => d.name) || [],
                publishers: game.publishers?.map((p: any) => p.name) || [],
                esrbRating: game.esrb_rating?.name || null,
                description: game.description_raw || '',
                website: game.website || null,
                redditUrl: game.reddit_url || null,
                playtime: game.playtime || 0,
                parentPlatforms: game.parent_platforms?.map((p: any) => p.platform.name) || []
            };
        } catch (error) {
            console.error("Failed to fetch game details:", error);
            return this.getDefaultDetails();
        }
    }

    private getDefaultDetails() {
        return {
            allTags: [],
            developers: [],
            publishers: [],
            esrbRating: null,
            description: '',
            website: null,
            redditUrl: null,
            playtime: 0,
            parentPlatforms: []
        };
    }

    /**
     * Filter and clean RAWG tags
     * Removes noisy utility tags and keeps only descriptive gameplay tags
     */
    private filterTags(tags: Array<{ name: string; language?: string }>): string[] {
        return tags
            .filter(t => {
                // Only include English tags
                if (t.language && t.language !== 'eng') return false;
                // Exclude blocked tags (case-insensitive)
                const tagLower = t.name.toLowerCase();
                return !RawgStrategy.BLOCKED_TAGS.some(
                    blocked => blocked.toLowerCase() === tagLower
                );
            })
            .map(t => t.name)
            .slice(0, 15);
    }

    /**
     * Categorize game based on publisher/developer
     */
    private getStudioCategory(developers: string[], publishers: string[]): string {
        const all = [...developers, ...publishers].map(s => s.toLowerCase());

        // Major AAA publishers
        const aaaPublishers = ['sony', 'microsoft', 'nintendo', 'ea', 'ubisoft', 'activision',
            'blizzard', 'square enix', 'bandai namco', 'capcom', 'sega', 'rockstar', 'take-two',
            'warner bros', 'bethesda', '2k games', 'thq'];

        if (all.some(s => aaaPublishers.some(p => s.includes(p)))) {
            return 'AAA';
        }

        // Mid-tier publishers
        const midTier = ['devolver', 'focus', 'paradox', 'team17', 'raw fury', 'annapurna'];
        if (all.some(s => midTier.some(p => s.includes(p)))) {
            return 'Mid-tier';
        }

        return 'Indie';
    }

    /**
     * Get gameplay style from tags
     */
    private getGameplayStyle(tags: string[]): string {
        const tagStr = tags.join(' ').toLowerCase();
        const styles: string[] = [];

        if (/souls-like|soulslike|souls/.test(tagStr)) styles.push('Souls-like');
        if (/roguelike|roguelite|permadeath/.test(tagStr)) styles.push('Roguelike');
        if (/metroidvania/.test(tagStr)) styles.push('Metroidvania');
        if (/open world|open-world/.test(tagStr)) styles.push('Open World');
        if (/story-rich|story rich|narrative/.test(tagStr)) styles.push('Story-Rich');
        if (/atmospheric/.test(tagStr)) styles.push('Atmospheric');
        if (/difficult|challenging|hardcore/.test(tagStr)) styles.push('Difficult');
        if (/relaxing|peaceful|calm/.test(tagStr)) styles.push('Relaxing');
        if (/horror|scary|creepy/.test(tagStr)) styles.push('Horror');
        if (/cyberpunk|futuristic/.test(tagStr)) styles.push('Cyberpunk');

        return styles.slice(0, 3).join(', ') || '';
    }

    async search(query: string, settings: SystemSettings): Promise<MediaSearchResponse> {
        const apiKey = settings['rawg_api_key'];
        const apiUrl = settings['rawg_api_url'] || 'https://api.rawg.io/api';

        if (!apiKey) {
            console.warn("RAWG API Key missing");
            return { success: false, data: [], error: "Missing RAWG API Key" };
        }

        try {
            const res = await fetch(`${apiUrl}/games?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=5`);
            if (!res.ok) return { success: false, data: [], error: `RAWG API Error: ${res.statusText}` };

            const data = await res.json();

            // Process games with enhanced metadata (parallel fetching)
            const resultsPromises = (data.results || []).slice(0, 5).map(async (item: any) => {
                // Fetch detailed game info
                const details = await this.fetchGameDetails(apiKey, item.id, apiUrl);

                // Extract platform names from search result
                const platforms = item.platforms?.map((p: any) => p.platform.name) || [];
                const platformsSummary = platforms.slice(0, 4).join(', ');

                // Get genre names from search result
                const genres = item.genres?.map((g: any) => g.name) || [];

                // Filter tags to remove noise
                const cleanedTags = this.filterTags(details.allTags);

                // Determine studio category (AAA, Mid-tier, Indie)
                const studioCategory = this.getStudioCategory(details.developers, details.publishers);

                // Get gameplay style from cleaned tags
                const gameplayStyle = this.getGameplayStyle(cleanedTags);

                // Build description
                const descParts: string[] = [];
                if (genres.length > 0) {
                    descParts.push(genres.slice(0, 2).join(', '));
                }
                if (gameplayStyle) {
                    descParts.push(gameplayStyle);
                }
                if (item.metacritic) {
                    descParts.push(`Metacritic: ${item.metacritic}`);
                }
                if (details.developers.length > 0) {
                    descParts.push(`by ${details.developers[0]}`);
                }

                // Combine genres and cleaned tags (tags are more granular)
                const allTags = [...new Set([
                    ...genres,
                    ...cleanedTags.slice(0, 8)
                ])].slice(0, 10);

                // Build AI analysis payload with CLEANED tags
                const analysisPayload = `Type: Video Game. Title: ${item.name}. Developer: ${details.developers.join(", ")}. Genres: ${genres.join(", ")}. Tags: ${cleanedTags.slice(0, 10).join(", ")}. Metacritic: ${item.metacritic || 'N/A'}. Age Rating: ${details.esrbRating || "Not Rated"}. Platform Family: ${details.parentPlatforms.join(", ")}. Description: ${details.description.substring(0, 500)}`;

                return {
                    id: `rawg-${item.id}`,
                    type: 'game',
                    title: item.name,
                    description: descParts.join(' • ') || `Released: ${item.released}`,
                    imageUrl: item.background_image || "",
                    year: item.released?.split('-')[0] || undefined,
                    tags: allTags,
                    metadata: JSON.stringify({
                        rawgId: item.id,
                        type: 'game',
                        // Display Data
                        released: item.released,
                        rating: item.rating,
                        ratingTop: item.rating_top,
                        ratingsCount: item.ratings_count,
                        metacritic: item.metacritic,
                        playtime: details.playtime,
                        // Platforms
                        platforms: platforms,
                        platformsSummary: platformsSummary,
                        parentPlatforms: details.parentPlatforms,
                        // Genres & Tags (CLEANED)
                        genres: genres,
                        tags: cleanedTags,
                        rawTagCount: details.allTags.length,
                        cleanedTagCount: cleanedTags.length,
                        gameplayStyle: gameplayStyle,
                        // Studio Data (Developer is key for "vibe")
                        developers: details.developers,
                        publishers: details.publishers,
                        studioCategory: studioCategory,
                        // Content Rating
                        esrbRating: details.esrbRating,
                        // Links
                        website: details.website,
                        redditUrl: details.redditUrl,
                        // AI Analysis Payload
                        analysisPayload: analysisPayload
                    })
                };
            });

            const results = await Promise.all(resultsPromises);

            return { success: true, data: results };
        } catch (error) {
            console.error("RAWG API error:", error);
            return { success: false, data: [], error: "RAWG Unreachable" };
        }
    }
}
