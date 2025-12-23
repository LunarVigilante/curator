'use server'

import { getSettings } from "@/lib/actions/settings";
import { MediaService } from "@/lib/services/media/mediaService";

const mediaService = new MediaService();

export async function searchMediaAction(query: string, categoryName: string) {
    if (!query || !categoryName) return [];

    try {
        const settings = await getSettings();
        const results = await mediaService.search(query, categoryName, settings);
        return results;
    } catch (error) {
        console.error("Search Media Action Error:", error);
        return [];
    }
}
