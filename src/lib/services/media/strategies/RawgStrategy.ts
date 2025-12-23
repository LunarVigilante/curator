import { MediaResult, MediaStrategy } from "../types";

export class RawgStrategy implements MediaStrategy {
    name = "Video Games";

    async search(query: string, settings: Record<string, string>): Promise<MediaResult[]> {
        const apiKey = settings['rawg_api_key'];
        if (!apiKey) {
            console.warn("RAWG API Key missing");
            return [];
        }

        try {
            const res = await fetch(`https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=5`);
            if (!res.ok) return [];

            const data = await res.json();

            return (data.results || []).map((item: any) => ({
                title: item.name,
                description: `Released: ${item.released}. Rating: ${item.rating}/5`, // RAWG descriptions are often detailed HTML, simpler to summarize metadata
                imageUrl: item.background_image || "",
                year: item.released?.split('-')[0] || "",
                tags: (item.genres || []).map((g: any) => g.name),
                metadata: JSON.stringify({
                    platforms: item.platforms?.map((p: any) => p.platform.name).slice(0, 3).join(', '),
                    metacritic: item.metacritic
                })
            }));
        } catch (error) {
            console.error("RAWG API error:", error);
            return [];
        }
    }
}
