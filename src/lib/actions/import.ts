'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/auth'
import { getImportRouter, reconcileItems } from '@/lib/services/import'
import type { ImportResult, ReconciledItem, ParsedImport } from '@/lib/types/import'

// ============================================================================
// MAGIC IMPORT - MAIN ENTRY POINT
// ============================================================================

export async function magicImport(
    input: string,
    options?: {
        autoReconcile?: boolean
        autoCreate?: boolean
        collectionName?: string
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

        let reconciledItems: ReconciledItem[]
        if (autoReconcile) {
            reconciledItems = await reconcileItems(parsed.items, parsed.mediaType)
        } else {
            reconciledItems = parsed.items.map(item => ({
                ...item,
                matched: false,
                matchScore: 0
            }))
        }

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
// PREVIEW IMPORT
// ============================================================================

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
    const supabase = await createClient()
    const warnings: string[] = []
    let itemsCreated = 0
    let itemsSkipped = 0

    // 1. Create the category
    const { data: category, error: categoryError } = await (supabase.from('categories') as any)
        .insert({
            name: collectionTitle,
            description: collectionDescription,
            user_id: userId,
            is_public: false,
            sort_order: 0
        })
        .select()
        .single()

    if (categoryError) throw categoryError

    // 2. Create items
    for (const item of reconciledItems) {
        try {
            let globalItemId: string | null = null

            if (item.externalId && item.matched) {
                const { data: existing } = await (supabase.from('global_items') as any)
                    .select('id')
                    .eq('external_id', item.externalId)
                    .single()

                if (existing) {
                    globalItemId = existing.id
                } else {
                    const { data: newGlobal, error: globalError } = await (supabase.from('global_items') as any)
                        .insert({
                            title: item.title,
                            description: item.description,
                            image_url: item.imageUrl,
                            release_year: item.releaseYear,
                            external_id: item.externalId
                        })
                        .select()
                        .single()

                    if (!globalError && newGlobal) {
                        globalItemId = newGlobal.id
                    }
                }
            }

            // Create user item
            await (supabase.from('items') as any).insert({
                user_id: userId,
                category_id: category.id,
                global_item_id: globalItemId,
                name: item.title,
                description: item.description,
                image: item.imageUrl,
                tier: null,
                elo_score: 1200,
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

    return {
        success: true,
        categoryId: category.id,
        categoryName: category.name,
        itemsCreated,
        itemsSkipped,
        warnings,
        items: reconciledItems
    }
}

// ============================================================================
// DETECT SOURCE
// ============================================================================

export async function detectImportSourceType(input: string) {
    const router = getImportRouter()
    return router.detectSource(input)
}
