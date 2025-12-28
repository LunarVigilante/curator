import { MediaStrategy, MediaSearchResponse } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';

/**
 * Enhanced ComicVine Strategy for Western Comics
 * 
 * IMPORTANT NOTES:
 * - Western comics run in "Issues" belonging to "Volumes" (Series)
 * - Users search for Volume names or Story Arcs, not individual issues
 * - Creative Team (Writer + Artist) is THE most important metadata
 * - Must include custom User-Agent header or ComicVine blocks requests
 * 
 * API Endpoints:
 * - Search: /search/?resources=volume
 * - Volume Details: /volume/4050-{id}/
 * - Issue Details: /issue/4000-{id}/
 */
export class ComicVineStrategy implements MediaStrategy {
    name = "Comics";
    description = "Search for comics using ComicVine API with creative team and story arc metadata";

    // Required User-Agent header
    private userAgent = 'Curator/1.0 (Personal Collection Manager)';

    /**
     * Fetch detailed volume info with characters, people, etc.
     */
    private async fetchVolumeDetails(apiKey: string, volumeId: number, apiUrl: string): Promise<{
        characters: Array<{ id: number; name: string }>;
        people: Array<{ id: number; name: string; role?: string }>;
        concepts: Array<{ id: number; name: string }>;
        locations: Array<{ id: number; name: string }>;
        firstIssue: { id: number; name: string; issueNumber: string } | null;
        lastIssue: { id: number; name: string; issueNumber: string } | null;
    }> {
        try {
            const response = await fetch(
                `${apiUrl}/volume/4050-${volumeId}/?api_key=${apiKey}&format=json&field_list=characters,people,concepts,locations,first_issue,last_issue`,
                { headers: { 'User-Agent': this.userAgent } }
            );

            if (!response.ok) {
                return this.getDefaultVolumeDetails();
            }

            const data = await response.json();
            if (data.error !== 'OK') {
                return this.getDefaultVolumeDetails();
            }

            const volume = data.results || {};

            return {
                characters: (volume.characters || []).slice(0, 10).map((c: any) => ({ id: c.id, name: c.name })),
                people: (volume.people || []).slice(0, 15).map((p: any) => ({ id: p.id, name: p.name, role: p.role })),
                concepts: (volume.concepts || []).slice(0, 10).map((c: any) => ({ id: c.id, name: c.name })),
                locations: (volume.locations || []).slice(0, 5).map((l: any) => ({ id: l.id, name: l.name })),
                firstIssue: volume.first_issue ? {
                    id: volume.first_issue.id,
                    name: volume.first_issue.name,
                    issueNumber: volume.first_issue.issue_number
                } : null,
                lastIssue: volume.last_issue ? {
                    id: volume.last_issue.id,
                    name: volume.last_issue.name,
                    issueNumber: volume.last_issue.issue_number
                } : null
            };
        } catch (error) {
            console.error("Failed to fetch volume details:", error);
            return this.getDefaultVolumeDetails();
        }
    }

    private getDefaultVolumeDetails() {
        return {
            characters: [],
            people: [],
            concepts: [],
            locations: [],
            firstIssue: null,
            lastIssue: null
        };
    }

    /**
     * Extract credits by role from people array
     */
    private getCredits(people: Array<{ name: string; role?: string }>, roleFilter: string): string[] {
        return people
            .filter(p => p.role && p.role.toLowerCase().includes(roleFilter.toLowerCase()))
            .map(p => p.name);
    }

    /**
     * Get comic era based on year
     */
    private getComicEra(year: string | number): string {
        const y = typeof year === 'string' ? parseInt(year) : year;
        if (!y || isNaN(y)) return 'Unknown';
        if (y < 1938) return 'Pre-Golden Age';
        if (y < 1956) return 'Golden Age';
        if (y < 1970) return 'Silver Age';
        if (y < 1985) return 'Bronze Age';
        if (y < 2011) return 'Modern Age';
        return 'Contemporary';
    }

    /**
     * Get publisher category
     */
    private getPublisherCategory(publisher: string): string {
        const pubLower = publisher.toLowerCase();

        if (/marvel/.test(pubLower)) return 'Marvel';
        if (/dc comics|detective comics/.test(pubLower)) return 'DC';
        if (/image/.test(pubLower)) return 'Image';
        if (/dark horse/.test(pubLower)) return 'Dark Horse';
        if (/idw/.test(pubLower)) return 'IDW';
        if (/valiant/.test(pubLower)) return 'Valiant';
        if (/boom/.test(pubLower)) return 'BOOM!';
        if (/dynamite/.test(pubLower)) return 'Dynamite';
        if (/vertigo/.test(pubLower)) return 'Vertigo (DC)';
        if (/wildstorm/.test(pubLower)) return 'WildStorm';

        return 'Independent';
    }

    async search(query: string, settings: SystemSettings): Promise<MediaSearchResponse> {
        const apiKey = settings['comicvine_api_key'];
        const apiUrl = settings['comicvine_api_url'] || 'https://comicvine.gamespot.com/api';

        if (!apiKey) {
            return {
                success: false,
                data: [],
                error: "ComicVine API key missing. Add it in Admin Settings > Media API Keys."
            };
        }

        try {
            // Search for volumes (comic series/trade paperbacks)
            const res = await fetch(
                `${apiUrl}/search/?api_key=${apiKey}&format=json&query=${encodeURIComponent(query)}&resources=volume&limit=10`,
                { headers: { 'User-Agent': this.userAgent } }
            );

            if (!res.ok) {
                return { success: false, data: [], error: `ComicVine API Error: ${res.statusText}` };
            }

            const data = await res.json();

            if (data.error !== 'OK') {
                return { success: false, data: [], error: data.error || 'ComicVine API Error' };
            }

            // Process volumes with enhanced metadata (parallel fetching)
            const resultsPromises = (data.results || []).slice(0, 5).map(async (item: any) => {
                // Get publisher name
                const publisher = item.publisher?.name || '';
                const publisherCategory = this.getPublisherCategory(publisher);

                // Get issue count
                const issueCount = item.count_of_issues || 0;

                // Get start year and era
                const year = item.start_year || '';
                const era = this.getComicEra(year);

                // Fetch detailed volume info
                const details = await this.fetchVolumeDetails(apiKey, item.id, apiUrl);

                // Extract creative team credits
                const writers = this.getCredits(details.people, 'writer');
                const pencilers = this.getCredits(details.people, 'pencil');
                const artists = this.getCredits(details.people, 'artist');
                const inkers = this.getCredits(details.people, 'ink');
                const colorists = this.getCredits(details.people, 'color');

                // Combine artists (pencilers + general artists)
                const allArtists = [...new Set([...pencilers, ...artists])];

                // Build description
                let description = item.deck || '';
                if (!description && item.description) {
                    // Strip HTML tags from description
                    description = item.description
                        .replace(/<[^>]*>/g, '')
                        .substring(0, 200);
                    if (item.description.length > 200) description += '...';
                }

                // Build display description
                const descParts: string[] = [];
                if (publisher) descParts.push(publisher);
                if (writers.length > 0) descParts.push(`by ${writers[0]}`);
                if (issueCount) descParts.push(`${issueCount} issues`);
                if (year) descParts.push(`(${year})`);

                // Get image URL (original_url for high-res)
                const imageUrl = item.image?.original_url || item.image?.medium_url || item.image?.small_url || null;

                // Build tags from characters and concepts
                const tags = [
                    ...details.characters.slice(0, 3).map(c => c.name),
                    ...(publisher ? [publisher] : [])
                ].slice(0, 5);

                // Build AI analysis payload
                const analysisPayload = `Type: Comic Book Series. Series: ${item.name}. Publisher: ${publisher}. Era: ${era}. Writer: ${writers.join(", ") || "Unknown"}. Artist: ${allArtists.join(", ") || "Unknown"}. Characters: ${details.characters.map(c => c.name).slice(0, 5).join(", ")}. Concepts: ${details.concepts.map(c => c.name).slice(0, 5).join(", ")}. Description: ${description}`;

                return {
                    id: `comicvine-${item.id}`,
                    type: 'comic',
                    title: item.name,
                    description: descParts.join(' • ') || description || `${publisher ? `Published by ${publisher}. ` : ''}${issueCount} issues.`,
                    imageUrl,
                    year,
                    tags,
                    metadata: JSON.stringify({
                        comicVineId: item.id,
                        type: 'volume',
                        siteDetailUrl: item.site_detail_url,
                        // Publisher Info
                        publisher,
                        publisherCategory,
                        // Era & Dates
                        startYear: year,
                        era: era,
                        // Issue Info
                        issueCount,
                        firstIssue: details.firstIssue,
                        lastIssue: details.lastIssue,
                        // Creative Team (CRITICAL for ranking)
                        writers: writers,
                        pencilers: pencilers,
                        artists: allArtists,
                        inkers: inkers,
                        colorists: colorists,
                        allCreativeTeam: details.people.slice(0, 10),
                        // Characters & Concepts (for AI/Vector)
                        characters: details.characters,
                        concepts: details.concepts,
                        locations: details.locations,
                        // Description
                        description: description,
                        // AI Analysis Payload
                        analysisPayload: analysisPayload
                    })
                };
            });

            const results = await Promise.all(resultsPromises);

            return { success: true, data: results };
        } catch (error) {
            console.error("ComicVine API error:", error);
            return { success: false, data: [], error: "ComicVine API Unreachable" };
        }
    }
}
