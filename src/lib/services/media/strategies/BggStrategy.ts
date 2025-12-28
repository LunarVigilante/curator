import { MediaStrategy, MediaSearchResponse } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';

/**
 * Enhanced BoardGameGeek Strategy
 * 
 * IMPORTANT NOTES:
 * - BGG API returns XML, not JSON
 * - Must include stats=1 to get rank and weight data
 * - averageweight (1.0-5.0) is THE most important metric for board gamers
 * - min/maxplayers is often unreliable; use suggested_numplayers poll
 * 
 * Complexity Classes:
 * - 1.0-2.0: "Beer & Pretzels" (Casual)
 * - 2.0-3.2: Medium
 * - 3.2-4.0: Heavy
 * - 4.0-5.0: Brain Burner
 * 
 * API: https://boardgamegeek.com/xmlapi2/thing?id={id}&stats=1
 */
export class BggStrategy implements MediaStrategy {
    name = "Board Games";
    description = "Search for board games using BGG API with mechanics, weight, and player count data";

    private userAgent = 'Curator/1.0 (Personal Collection Manager)';

    /**
     * Parse link elements from XML by type
     */
    private parseLinksByType(xml: string, linkType: string): string[] {
        const regex = new RegExp(`<link type="${linkType}"[^>]*value="([^"]+)"`, 'g');
        const values: string[] = [];
        let match;
        while ((match = regex.exec(xml)) !== null) {
            values.push(match[1]);
        }
        return values;
    }

    /**
     * Parse the "suggested_numplayers" poll to find the best player count
     */
    private parseBestPlayerCount(xml: string): { best: string; recommended: string[] } {
        // This is complex because the poll structure is nested
        // <poll name="suggested_numplayers">
        //   <results numplayers="4">
        //     <result value="Best" numvotes="500"/>
        //     <result value="Recommended" numvotes="200"/>
        //     <result value="Not Recommended" numvotes="50"/>
        //   </results>
        // </poll>

        const pollMatch = xml.match(/<poll[^>]*name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll>/);
        if (!pollMatch) return { best: '', recommended: [] };

        const pollContent = pollMatch[1];
        const resultsRegex = /<results[^>]*numplayers="([^"]+)"[^>]*>([\s\S]*?)<\/results>/g;

        let bestPlayerCount = '';
        let bestVotes = 0;
        const recommended: string[] = [];

        let resultsMatch;
        while ((resultsMatch = resultsRegex.exec(pollContent)) !== null) {
            const numPlayers = resultsMatch[1];
            const resultsContent = resultsMatch[2];

            // Get "Best" votes
            const bestMatch = resultsContent.match(/<result[^>]*value="Best"[^>]*numvotes="(\d+)"/);
            const recMatch = resultsContent.match(/<result[^>]*value="Recommended"[^>]*numvotes="(\d+)"/);
            const notRecMatch = resultsContent.match(/<result[^>]*value="Not Recommended"[^>]*numvotes="(\d+)"/);

            const bestVotesNum = bestMatch ? parseInt(bestMatch[1]) : 0;
            const recVotesNum = recMatch ? parseInt(recMatch[1]) : 0;
            const notRecVotesNum = notRecMatch ? parseInt(notRecMatch[1]) : 0;

            // Track best player count
            if (bestVotesNum > bestVotes && bestVotesNum > notRecVotesNum) {
                bestVotes = bestVotesNum;
                bestPlayerCount = numPlayers;
            }

            // Track recommended counts
            if (bestVotesNum > notRecVotesNum || recVotesNum > notRecVotesNum) {
                recommended.push(numPlayers);
            }
        }

        return { best: bestPlayerCount, recommended };
    }

    /**
     * Get weight/complexity class description
     */
    private getWeightClass(weight: number): string {
        if (weight === 0) return 'Unknown';
        if (weight < 1.5) return 'Light (Party Game)';
        if (weight < 2.0) return 'Light-Medium (Casual)';
        if (weight < 2.5) return 'Medium (Gateway+)';
        if (weight < 3.0) return 'Medium-Heavy';
        if (weight < 3.5) return 'Heavy';
        if (weight < 4.0) return 'Very Heavy';
        return 'Brain Burner';
    }

    /**
     * Clean HTML description
     */
    private cleanDescription(html: string): string {
        return html
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#10;/g, ' ')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async search(query: string, settings: SystemSettings): Promise<MediaSearchResponse> {
        const apiKey = settings['bgg_api_key'];
        const apiUrl = settings['bgg_api_url'] || 'https://boardgamegeek.com/xmlapi2';

        if (!apiKey) {
            return {
                success: false,
                data: [],
                error: "BGG requires an API key. Register at boardgamegeek.com and add the key in Admin Settings."
            };
        }

        try {
            // Step 1: Search for games
            const searchUrl = `${apiUrl}/search?query=${encodeURIComponent(query)}&type=boardgame`;

            const searchRes = await fetch(searchUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/xml'
                }
            });

            if (searchRes.status === 401 || searchRes.status === 403) {
                return {
                    success: false,
                    data: [],
                    error: "BGG API requires registration. Visit boardgamegeek.com/wiki/page/XML_API_Terms_of_Use"
                };
            }

            if (!searchRes.ok) {
                return { success: false, data: [], error: `BGG API Error: ${searchRes.status} ${searchRes.statusText}` };
            }

            const searchXml = await searchRes.text();

            // Parse search results to get game IDs
            const itemMatches = searchXml.match(/<item[^>]*id="(\d+)"[^>]*>/g) || [];
            const gameIds = itemMatches.slice(0, 5).map(item => {
                const match = item.match(/id="(\d+)"/);
                return match ? match[1] : null;
            }).filter(Boolean);

            if (gameIds.length === 0) {
                return { success: true, data: [] };
            }

            // Step 2: Get detailed info for each game (with stats=1 for weight/rank)
            const detailUrl = `${apiUrl}/thing?id=${gameIds.join(',')}&stats=1`;

            const detailRes = await fetch(detailUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/xml'
                }
            });

            if (!detailRes.ok) {
                return { success: false, data: [], error: `BGG Details Error: ${detailRes.statusText}` };
            }

            const detailXml = await detailRes.text();

            // Parse each item from XML
            const items = detailXml.split(/<item[^>]*type="boardgame"[^>]*>/).slice(1);

            const results = items.map((itemXml, index) => {
                // Extract ID from the original search results
                const id = gameIds[index] || '';

                // Get primary name
                const nameMatch = itemXml.match(/<name type="primary"[^>]*value="([^"]+)"/);
                const title = nameMatch ? nameMatch[1] : 'Unknown Game';

                // Get year published
                const yearMatch = itemXml.match(/<yearpublished[^>]*value="([^"]+)"/);
                const year = yearMatch ? yearMatch[1] : '';

                // Get description (HTML entities encoded)
                const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
                let description = descMatch ? this.cleanDescription(descMatch[1]) : '';
                if (description.length > 300) description = description.substring(0, 300) + '...';

                // Get image
                const imageMatch = itemXml.match(/<image>([^<]+)<\/image>/);
                const imageUrl = imageMatch ? imageMatch[1] : null;

                // Get player count
                const minPlayersMatch = itemXml.match(/<minplayers[^>]*value="([^"]+)"/);
                const maxPlayersMatch = itemXml.match(/<maxplayers[^>]*value="([^"]+)"/);
                const minPlayers = minPlayersMatch ? parseInt(minPlayersMatch[1]) : 0;
                const maxPlayers = maxPlayersMatch ? parseInt(maxPlayersMatch[1]) : 0;

                // Get playing time
                const playingTimeMatch = itemXml.match(/<playingtime[^>]*value="([^"]+)"/);
                const minPlayTimeMatch = itemXml.match(/<minplaytime[^>]*value="([^"]+)"/);
                const maxPlayTimeMatch = itemXml.match(/<maxplaytime[^>]*value="([^"]+)"/);
                const playingTime = playingTimeMatch ? parseInt(playingTimeMatch[1]) : 0;
                const minPlayTime = minPlayTimeMatch ? parseInt(minPlayTimeMatch[1]) : 0;
                const maxPlayTime = maxPlayTimeMatch ? parseInt(maxPlayTimeMatch[1]) : 0;

                // Get BGG rating and rank
                const ratingMatch = itemXml.match(/<average[^>]*value="([^"]+)"/);
                const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

                const rankMatch = itemXml.match(/<rank[^>]*name="boardgame"[^>]*value="(\d+)"/);
                const bggRank = rankMatch ? parseInt(rankMatch[1]) : 0;

                // Get WEIGHT (THE most important metric)
                const weightMatch = itemXml.match(/<averageweight[^>]*value="([^"]+)"/);
                const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
                const weightClass = this.getWeightClass(weight);

                // Parse best player count from poll
                const playerCountPoll = this.parseBestPlayerCount(itemXml);

                // Extract mechanics, categories, designers, artists
                const mechanics = this.parseLinksByType(itemXml, 'boardgamemechanic');
                const categories = this.parseLinksByType(itemXml, 'boardgamecategory');
                const designers = this.parseLinksByType(itemXml, 'boardgamedesigner');
                const artists = this.parseLinksByType(itemXml, 'boardgameartist');
                const publishers = this.parseLinksByType(itemXml, 'boardgamepublisher');

                // Build display description
                const descParts: string[] = [];
                if (designers.length > 0) descParts.push(`by ${designers[0]}`);
                if (weight > 0) descParts.push(`${weight.toFixed(1)}/5 (${weightClass})`);
                if (minPlayers && maxPlayers) descParts.push(`${minPlayers}-${maxPlayers}P`);
                if (playingTime) descParts.push(`${playingTime}min`);

                // Combine mechanics and categories for tags (prioritize mechanics)
                const tags = [...mechanics.slice(0, 5), ...categories.slice(0, 3)].slice(0, 8);

                // Build AI analysis payload
                const analysisPayload = `Type: Board Game. Title: ${title}. Designer: ${designers.join(", ") || "Unknown"}. Complexity: ${weight.toFixed(2)}/5.0 (${weightClass}). Mechanics: ${mechanics.join(", ")}. Theme: ${categories.join(", ")}. Best Player Count: ${playerCountPoll.best || "Unknown"}. Time: ${playingTime} minutes. Description: ${description.substring(0, 400)}`;

                return {
                    id: `bgg-${id}`,
                    type: 'board_game',
                    title,
                    description: descParts.join(' • ') || description.substring(0, 100),
                    imageUrl,
                    year,
                    tags,
                    metadata: JSON.stringify({
                        bggId: id,
                        type: 'board_game',
                        siteUrl: `https://boardgamegeek.com/boardgame/${id}`,
                        // Player Count
                        minPlayers,
                        maxPlayers,
                        playerRange: `${minPlayers}-${maxPlayers}`,
                        bestPlayerCount: playerCountPoll.best,
                        recommendedPlayerCounts: playerCountPoll.recommended,
                        // Time
                        playingTime,
                        minPlayTime,
                        maxPlayTime,
                        // Ratings & Rank
                        bggRating: rating.toFixed(1),
                        bggRank: bggRank,
                        // WEIGHT (CRITICAL)
                        weight: weight.toFixed(2),
                        weightClass: weightClass,
                        // Mechanics (CRITICAL for AI)
                        mechanics: mechanics,
                        // Theme/Categories
                        categories: categories,
                        // Designers & Artists
                        designers: designers,
                        artists: artists,
                        publishers: publishers,
                        // Description
                        description: description,
                        // AI Analysis Payload
                        analysisPayload: analysisPayload
                    })
                };
            });

            return { success: true, data: results };
        } catch (error) {
            console.error("BGG API error:", error);
            return { success: false, data: [], error: "BGG API Unreachable" };
        }
    }
}
