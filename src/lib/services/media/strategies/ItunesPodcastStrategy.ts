import { MediaStrategy, MediaResult } from "../types";

export class ItunesPodcastStrategy implements MediaStrategy {
    name = "iTunes Podcasts";
    description = "Search for podcasts using iTunes Search API";

    async search(query: string, settings: Record<string, string>): Promise<MediaResult[]> {
        // iTunes Public API - No Key Required
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&limit=5`);
            if (!response.ok) return [];

            const data = await response.json();
            if (!data.results) return [];

            return data.results.map((item: any) => {
                const year = item.releaseDate ? item.releaseDate.substring(0, 4) : undefined;

                return {
                    id: String(item.collectionId),
                    title: item.collectionName || item.trackName,
                    description: item.artistName ? `Hosted by ${item.artistName}` : '', // Descriptions aren't always great in list view list
                    imageUrl: item.artworkUrl600 || item.artworkUrl100,
                    year: year,
                    metadata: {
                        artist: item.artistName,
                        genre: item.primaryGenreName,
                        episodes: item.trackCount
                    }
                };
            });
        } catch (error) {
            console.error("iTunes Podcast search failed:", error);
            return [];
        }
    }
}
