'use server'

import { db } from '@/lib/db'
import { categories, items, globalItems } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { getImportRouter, reconcileItems } from '@/lib/services/import'
import type { ImportResult, ReconciledItem, ParsedImport } from '@/lib/types/import'

// ============================================================================
// AUTH HELPER
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id || null
}

// ============================================================================
// MAGIC IMPORT - MAIN ENTRY POINT
// ============================================================================

/**
 * Magic Import - Parse any input and create a collection
 * 
 * @param input - URL or unstructured text
 * @param options - Optional configuration
 * @returns ImportResult with created collection details
 */
export async function magicImport(
    input: string,
    options?: {
        autoReconcile?: boolean   // Match items with external APIs (default: true)
        autoCreate?: boolean      // Create collection automatically (default: true)
        collectionName?: string   // Override inferred collection name
    }
): Promise<ImportResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return {
            success: false,
            itemsCreated: 0,
            itemsSkipped: 0,
            warnings: ['Not authenticated'],
            items: []
        }
    }

    const {
        autoReconcile = true,
        autoCreate = true,
        collectionName
    } = options || {}

    try {
        // 1. Route and parse input
        const router = getImportRouter()
        const parsed = await router.route(input)

        if (parsed.items.length === 0) {
            return {
                success: false,
                itemsCreated: 0,
                itemsSkipped: 0,
                warnings: parsed.warnings || ['No items could be parsed from input'],
                items: []
            }
        }

        // 2. Reconcile items with external APIs
        let reconciledItems: ReconciledItem[]
        if (autoReconcile) {
            reconciledItems = await reconcileItems(parsed.items, parsed.mediaType)
        } else {
            // Skip reconciliation, use raw parsed items
            reconciledItems = parsed.items.map(item => ({
                ...item,
                matched: false,
                matchScore: 0
            }))
        }

        // 3. Create collection if auto-create is enabled
        if (!autoCreate) {
            return {
                success: true,
                itemsCreated: 0,
                itemsSkipped: 0,
                warnings: [],
                items: reconciledItems
            }
        }

        const result = await createCollectionFromImport(
            userId,
            collectionName || parsed.collectionTitle,
            parsed.collectionDescription,
            reconciledItems,
            parsed.mediaType
        )

        return result

    } catch (error) {
        console.error('[magicImport] Error:', error)
        return {
            success: false,
            itemsCreated: 0,
            itemsSkipped: 0,
            warnings: [error instanceof Error ? error.message : 'Import failed'],
            items: []
        }
    }
}

// ============================================================================
// PREVIEW IMPORT (Parse without creating)
// ============================================================================

/**
 * Preview an import without creating anything
 * Useful for showing the user what will be created
 */
export async function previewImport(input: string): Promise<{
    success: boolean
    parsed?: ParsedImport
    reconciled?: ReconciledItem[]
    error?: string
}> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    try {
        const router = getImportRouter()
        const parsed = await router.route(input)

        if (parsed.items.length === 0) {
            return {
                success: false,
                error: 'No items could be parsed',
                parsed
            }
        }

        // Reconcile for preview
        const reconciled = await reconcileItems(parsed.items, parsed.mediaType)

        return {
            success: true,
            parsed,
            reconciled
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Parse failed'
        }
    }
}

// ============================================================================
// HELPER: Create Collection from Reconciled Items
// ============================================================================

async function createCollectionFromImport(
    userId: string,
    collectionTitle: string,
    collectionDescription: string | undefined,
    reconciledItems: ReconciledItem[],
    mediaType: string
): Promise<ImportResult> {
    const warnings: string[] = []
    let itemsCreated = 0
    let itemsSkipped = 0

    // Create within a transaction
    const result = await db.transaction(async (tx) => {
        // 1. Create the category
        const [category] = await tx.insert(categories)
            .values({
                name: collectionTitle,
                description: collectionDescription,
                userId,
                isPublic: false,
                sortOrder: 0
            })
            .returning()

        // 2. Create items
        for (const item of reconciledItems) {
            try {
                // Upsert global item if we have an external ID
                let globalItemId: string | null = null
                if (item.externalId && item.matched) {
                    const existing = await tx.query.globalItems.findFirst({
                        where: eq(globalItems.externalId, item.externalId)
                    })

                    if (existing) {
                        globalItemId = existing.id
                    } else {
                        const [newGlobal] = await tx.insert(globalItems)
                            .values({
                                title: item.title,
                                description: item.description,
                                imageUrl: item.imageUrl,
                                releaseYear: item.releaseYear,
                                externalId: item.externalId
                            })
                            .returning()
                        globalItemId = newGlobal.id
                    }
                }

                // Create user item
                await tx.insert(items).values({
                    userId,
                    categoryId: category.id,
                    globalItemId,
                    name: item.title,
                    description: item.description,
                    image: item.imageUrl,
                    tier: null,  // User will set tier
                    eloScore: 1200,
                    rank: item.rank || itemsCreated
                })

                itemsCreated++

                if (!item.matched) {
                    warnings.push(`"${item.title}" was not matched with external database`)
                }

            } catch (error) {
                console.error(`Failed to create item "${item.title}":`, error)
                itemsSkipped++
                warnings.push(`Failed to import "${item.title}"`)
            }
        }

        return category
    })

    return {
        success: true,
        categoryId: result.id,
        categoryName: result.name,
        itemsCreated,
        itemsSkipped,
        warnings,
        items: reconciledItems
    }
}

// ============================================================================
// DETECT SOURCE (For UI hints)
// ============================================================================

/**
 * Detect the source type of an input for UI hints
 */
export async function detectImportSourceType(input: string) {
    const router = getImportRouter()
    return router.detectSource(input)
}
