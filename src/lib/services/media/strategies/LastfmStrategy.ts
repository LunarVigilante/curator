import { MediaResult, MediaStrategy } from "../types";

export class LastfmStrategy implements MediaStrategy {
    name = "Music";

    async search(query: string, settings: Record<string, string>): Promise<MediaResult[]> {
        const apiKey = settings['lastfm_api_key'];
        if (!apiKey) {
            console.warn("Last.fm API Key missing");
            return [];
        }

        try {
            // Searching Albums by default as they have better art than tracks usually
            const res = await fetch(`http://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(query)}&api_key=${apiKey}&format=json&limit=5`);
            if (!res.ok) return [];

            const data = await res.json();
            const albums = data.results?.albummatches?.album || [];

            return albums.map((item: any) => {
                // Find extralarge image
                const imageObj = item.image?.find((img: any) => img.size === 'extralarge') || item.image?.find((img: any) => img.size === 'large');
                const imageUrl = imageObj ? imageObj['#text'] : "";

                return {
                    title: item.name,
                    description: `Artist: ${item.artist}`,
                    imageUrl: imageUrl,
                    year: "", // Last.fm search doesn't return year easily in search results
                    metadata: JSON.stringify({
                        artist: item.artist,
                        url: item.url
                    })
                };
            });
        } catch (error) {
            console.error("Last.fm API error:", error);
            return [];
        }
    }
}
