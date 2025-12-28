/**
 * Global Item Service
 * 
 * Handles deduplication and vector text generation for global items.
 * Works with Prisma + PostgreSQL.
 * 
 * Deduplication Strategy:
 * 1. Check if GlobalItem exists with matching (source, externalId)
 * 2. If exists and stale (>30 days), queue background refresh
 * 3. If not exists, create new GlobalItem with vectorText
 * 4. Always link user's Item to existing/new GlobalItem
 */

import { generateVectorText, parseMetadata, normalizeMediaType, MediaType } from '@/lib/metadata/generator';

// Staleness threshold in days
const STALE_THRESHOLD_DAYS = 30;

interface GlobalItemInput {
    externalId: string;
    source: string; // 'tmdb', 'anilist', 'spotify', 'rawg', etc.
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    releaseYear?: number | null;
    metadata?: Record<string, any> | string | null;
    categoryType?: string | null;
    cachedTags?: string[] | null;
}

interface GlobalItemResult {
    id: string;
    externalId: string | null;
    source: string | null;
    title: string;
    isNew: boolean;
    isStale: boolean;
    vectorText: string | null;
}

/**
 * Check if an item is stale (not updated in STALE_THRESHOLD_DAYS)
 */
function isStale(lastUpdate: Date | null): boolean {
    if (!lastUpdate) return true;
    const now = new Date();
    const diffDays = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > STALE_THRESHOLD_DAYS;
}

/**
 * Generate vector text from input data
 */
function generateVectorTextFromInput(input: GlobalItemInput): string {
    const mediaType = normalizeMediaType(input.categoryType);
    const metadata = typeof input.metadata === 'string'
        ? parseMetadata(input.metadata)
        : (input.metadata || {});

    return generateVectorText({
        type: mediaType,
        title: input.title,
        metadata: metadata,
        description: input.description || undefined,
    });
}

/**
 * Parse source from externalId string
 * e.g., "tmdb-12345" -> { source: "tmdb", id: "12345" }
 */
export function parseExternalId(externalId: string): { source: string; id: string } {
    const match = externalId.match(/^([a-z]+)-(.+)$/i);
    if (match) {
        return { source: match[1].toLowerCase(), id: match[2] };
    }
    // Fallback: use the whole thing as ID with unknown source
    return { source: 'unknown', id: externalId };
}

/**
 * Create composite external ID from source and ID
 */
export function createExternalId(source: string, id: string): string {
    return `${source.toLowerCase()}-${id}`;
}

/**
 * Upsert a GlobalItem with deduplication and staleness check.
 * 
 * For Prisma usage (when migrated):
 * ```
 * import { PrismaClient } from '@prisma/client'
 * const prisma = new PrismaClient()
 * 
 * const result = await upsertGlobalItemPrisma(prisma, input)
 * ```
 */
export async function upsertGlobalItemPrisma(
    prisma: any, // PrismaClient - typed as any for compatibility
    input: GlobalItemInput
): Promise<GlobalItemResult> {
    // 1. Check for existing GlobalItem by (source, externalId)
    const existing = await prisma.globalItem.findUnique({
        where: {
            source_externalId: {
                source: input.source,
                externalId: input.externalId,
            },
        },
    });

    if (existing) {
        // Check staleness
        const stale = isStale(existing.lastMetadataUpdate);

        return {
            id: existing.id,
            externalId: existing.externalId,
            source: existing.source,
            title: existing.title,
            isNew: false,
            isStale: stale,
            vectorText: existing.vectorText,
        };
    }

    // 2. Generate vector text
    const vectorText = generateVectorTextFromInput(input);

    // 3. Parse metadata
    const metadata = typeof input.metadata === 'string'
        ? JSON.parse(input.metadata)
        : input.metadata;

    // 4. Create new GlobalItem
    const newItem = await prisma.globalItem.create({
        data: {
            externalId: input.externalId,
            source: input.source,
            title: input.title,
            description: input.description,
            imageUrl: input.imageUrl,
            releaseYear: input.releaseYear,
            metadata: metadata,
            categoryType: input.categoryType,
            cachedTags: input.cachedTags,
            vectorText: vectorText,
            lastMetadataUpdate: new Date(),
        },
    });

    return {
        id: newItem.id,
        externalId: newItem.externalId,
        source: newItem.source,
        title: newItem.title,
        isNew: true,
        isStale: false,
        vectorText: vectorText,
    };
}

/**
 * Refresh stale GlobalItem metadata
 */
export async function refreshGlobalItemMetadata(
    prisma: any,
    globalItemId: string,
    updatedData: Partial<GlobalItemInput>
): Promise<void> {
    const existing = await prisma.globalItem.findUnique({
        where: { id: globalItemId },
    });

    if (!existing) return;

    // Merge metadata
    const existingMeta = existing.metadata || {};
    const newMeta = typeof updatedData.metadata === 'string'
        ? JSON.parse(updatedData.metadata)
        : (updatedData.metadata || {});
    const mergedMeta = { ...existingMeta, ...newMeta };

    // Regenerate vector text
    const vectorText = generateVectorText({
        type: normalizeMediaType(updatedData.categoryType || existing.categoryType),
        title: updatedData.title || existing.title,
        metadata: mergedMeta,
        description: updatedData.description || existing.description,
    });

    await prisma.globalItem.update({
        where: { id: globalItemId },
        data: {
            title: updatedData.title || existing.title,
            description: updatedData.description || existing.description,
            imageUrl: updatedData.imageUrl || existing.imageUrl,
            releaseYear: updatedData.releaseYear || existing.releaseYear,
            metadata: mergedMeta,
            categoryType: updatedData.categoryType || existing.categoryType,
            cachedTags: updatedData.cachedTags || existing.cachedTags,
            vectorText: vectorText,
            lastMetadataUpdate: new Date(),
        },
    });
}

/**
 * Get vector text preview for an item
 * Useful for Admin UI to verify AI is getting correct context
 */
export function getVectorTextPreview(input: {
    title: string;
    categoryType: string;
    metadata: Record<string, any> | string | null;
    description?: string | null;
}): string {
    const mediaType = normalizeMediaType(input.categoryType);
    const metadata = typeof input.metadata === 'string'
        ? parseMetadata(input.metadata)
        : (input.metadata || {});

    return generateVectorText({
        type: mediaType,
        title: input.title,
        metadata: metadata,
        description: input.description || undefined,
    });
}
