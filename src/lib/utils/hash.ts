/**
 * Semantic Hashing Utilities
 * 
 * Content-based hashing for change detection and cache invalidation
 */

import crypto from 'crypto';

/**
 * Compute SHA-256 hash of semantic fields for change detection.
 * 
 * Only re-embed content when semantic fields change:
 * - title, overview, cast, genres, status
 * 
 * Non-semantic fields (vote_count, poster_url, etc.) should NOT trigger re-embedding.
 * This saves Voyage-4 API costs during rehydration.
 * 
 * v4.6: Added status to hash inputs
 * - Status change (Returning Series → Ended) triggers "Legacy Framing" rewrite
 * - Without status in hash, this rewrite would be skipped
 * 
 * @param title - Content title
 * @param overview - Content description/overview
 * @param cast - Array of cast member names
 * @param genres - Array of genre names
 * @param status - Content status (Returning Series, Ended, Canceled, etc.)
 * @returns SHA-256 hash as hex string
 */
export function computeSemanticHash(
    title: string,
    overview: string,
    cast?: string[],
    genres?: string[],
    status?: string
): string {
    // Normalize inputs for consistent hashing
    const normalizedTitle = (title || '').toLowerCase().trim();
    const normalizedOverview = (overview || '').toLowerCase().trim();
    const normalizedCast = (cast || []).slice(0, 8).map(c => c.toLowerCase().trim()).sort().join('|');
    const normalizedGenres = (genres || []).map(g => g.toLowerCase().trim()).sort().join('|');
    // v4.6: Include status in hash to detect status flip
    const normalizedStatus = (status || '').toLowerCase().trim();

    // Combine into single string with delimiters
    const combined = `${normalizedTitle}##${normalizedOverview}##${normalizedCast}##${normalizedGenres}##${normalizedStatus}`;

    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * Check if semantic fields have changed (requires re-embedding)
 * 
 * @param existingHash - Hash stored in database
 * @param newHash - Hash computed from new content
 * @returns true if content has semantic changes
 */
export function hasSemanticChanges(existingHash: string | null, newHash: string): boolean {
    if (!existingHash) return true;  // No hash means always re-embed
    return existingHash !== newHash;
}
