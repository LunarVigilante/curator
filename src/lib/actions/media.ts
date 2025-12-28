'use server'

import { getSettings } from "@/lib/actions/settings";
import { MediaService } from "@/lib/services/media/mediaService";
import { getCategory } from "@/lib/actions/categories";

const mediaService = new MediaService();

export async function searchMediaAction(query: string, categoryName: string | null, typeArg: string | null, categoryId?: string) {
    if (!query) return { success: true, data: [] };

    let finalCategoryName = categoryName || '';
    let finalType = typeArg || undefined;

    // Source of Truth: Fetch from DB if ID is provided
    if (categoryId) {
        try {
            const category = await getCategory(categoryId);
            if (category) {
                finalCategoryName = category.name;
                if (category.metadata) {
                    try {
                        const parsed = JSON.parse(category.metadata);
                        if (parsed.type) finalType = parsed.type;
                    } catch (e) {
                        // ignore json error
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch fresh category in search action", error);
        }
    }

    console.log("Search Action:", { query, categoryName: finalCategoryName, type: finalType, categoryId });

    try {
        const settings = await getSettings();
        const results = await mediaService.search(query, finalCategoryName, settings, finalType);
        return results;
    } catch (error) {
        console.error("Search Media Action Error:", error);
        return { success: false, data: [], error: "Internal Server Error" };
    }
}
