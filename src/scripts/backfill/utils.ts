/**
 * Utility functions for backfill phases
 */

import { REQUIRED_METADATA_FIELDS } from './config';

/**
 * Check if an item has all 4 description parts with sufficient content
 */
export function hasAllDescriptionParts(item: any): boolean {
    const parts = item.description_parts;
    if (!parts) return false;
    // Check if all 4 parts exist and have content
    return !!(
        parts.premise && parts.premise.length > 50 &&
        parts.themes && parts.themes.length > 50 &&
        parts.tone && parts.tone.length > 50 &&
        parts.style && parts.style.length > 50
    );
}

/**
 * Get list of required metadata fields that are missing for an item
 */
export function getMissingMetadataFields(item: any): string[] {
    const requiredFields = REQUIRED_METADATA_FIELDS[item.category_type] || [];
    const missing: string[] = [];

    for (const field of requiredFields) {
        const value = item[field] ?? item.metadata?.[field];
        if (value === null || value === undefined || value === '' ||
            (Array.isArray(value) && value.length === 0)) {
            missing.push(field);
        }
    }

    return missing;
}
