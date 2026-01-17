// Validation utilities for ItemDetailView
// Extracted from ItemDetailView.tsx for reuse across category-specific components

/**
 * Check if a value is valid for display
 * Returns false for null, undefined, 0, "N/A", "Unknown", empty strings, etc.
 */
export function isValidValue(value: any): boolean {
    if (value === null || value === undefined) return false
    if (value === 0 || value === '0') return false
    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase()
        if (trimmed === '' || trimmed === 'n/a' || trimmed === 'unknown' || trimmed === 'null') return false
    }
    return true
}

