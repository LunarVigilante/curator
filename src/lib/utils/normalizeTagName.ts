/**
 * Normalize a tag name for consistent storage and lookup.
 * 
 * Rules:
 * 1. Trim leading/trailing whitespace
 * 2. Collapse multiple spaces to single space
 * 3. Title Case (capitalize first letter of each word)
 * 4. Keep small words lowercase (of, the, and, in, on, for, to, a, an)
 *    EXCEPT when they're the first word
 * 5. Preserve special characters (apostrophes, hyphens, numbers)
 * 
 * Examples:
 * - "'90s nostalgia" → "'90s Nostalgia"
 * - "OVERPOWERED PROTAGONIST" → "Overpowered Protagonist"
 * - "coming of age" → "Coming of Age"
 * - "sci-fi" → "Sci-Fi"
 */
export function normalizeTagName(name: string): string {
    if (!name) return ''

    // Small words to keep lowercase (except when first word)
    const smallWords = new Set(['of', 'the', 'and', 'in', 'on', 'for', 'to', 'a', 'an', 'or', 'vs'])

    return name
        .trim()
        .replace(/\s+/g, ' ')  // Collapse multiple spaces
        .split(' ')
        .map((word, index) => {
            if (!word) return ''

            // Keep small words lowercase, except when first word
            if (index > 0 && smallWords.has(word.toLowerCase())) {
                return word.toLowerCase()
            }

            // Handle hyphenated words: Sci-Fi, Neo-Noir
            if (word.includes('-')) {
                return word.split('-').map(part =>
                    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                ).join('-')
            }

            // Handle apostrophes at start: '90s → '90s (keep as-is for digits)
            if (word.startsWith("'") && /\d/.test(word)) {
                return word // Keep decade markers like '90s as-is
            }

            // Standard Title Case
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .join(' ')
}
