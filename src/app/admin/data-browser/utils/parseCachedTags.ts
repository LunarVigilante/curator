// Helper to safely parse cached_tags which may be in different formats due to migration
export function parseCachedTags(cached_tags: any): { id: string; name: string }[] {
    if (!cached_tags) return []

    // If it's a string, try to parse it
    let parsed = cached_tags
    if (typeof cached_tags === 'string') {
        try {
            parsed = JSON.parse(cached_tags)
        } catch {
            return []
        }
    }

    if (!Array.isArray(parsed)) return []

    // Handle array of strings (old format) vs array of {id, name} objects (new format)
    return parsed.map((tag: any, index: number) => {
        if (typeof tag === 'string') {
            return { id: `temp-${index}`, name: tag }
        }
        if (tag && typeof tag === 'object' && tag.name) {
            return { id: tag.id || `temp-${index}`, name: tag.name }
        }
        return null
    }).filter((t): t is { id: string; name: string } => t !== null)
}
