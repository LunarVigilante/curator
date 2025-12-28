import { MediaStrategy, MediaSearchResponse } from "../types";

export class JikanStrategy implements MediaStrategy {
    name = "Anime & Manga";

    async search(query: string): Promise<MediaSearchResponse> {
        // Try searching anime first
        // Jikan API: https://api.jikan.moe/v4/anime?q=...
        // We could also mix manga? For now focusing on anime as primary visual media.
        try {
            const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`);
            if (!res.ok) return { success: false, data: [], error: `Jikan API Error: ${res.statusText}` };

            const data = await res.json();

            const results = (data.data || []).map((item: any) => ({
                id: `kan-${item.mal_id}`, // Generate ID
                title: item.title_english || item.title,
                // Fallback to English title if available and preferred? Keep default title for now.
                description: item.synopsis || "No description available.",
                imageUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || "",
                year: item.year?.toString() || (item.aired?.prop?.from?.year?.toString()) || "",
                tags: [
                    ...(item.genres || []).map((g: any) => g.name),
                    ...(item.themes || []).map((t: any) => t.name)
                ],
                metadata: JSON.stringify({
                    type: item.type,
                    episodes: item.episodes,
                    score: item.score
                })
            }));
            return { success: true, data: results };
        } catch (error) {
            console.error("Jikan API error:", error);
            return { success: false, data: [], error: "Jikan API Unreachable" };
        }
    }
}
