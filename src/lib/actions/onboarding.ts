'use server'

import { db } from '@/lib/db'
import { categories, items, globalItems, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import {
    CALIBRATION_QUESTIONS,
    STARTER_TEMPLATES,
    type CalibrationAnswer,
    type StarterTemplate,
    type BinaryRaterVotePayload,
    type BinaryRaterResult,
    type BinaryRaterItem
} from '@/lib/types/onboarding'

// ============================================================================
// AUTH HELPER
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id || null
}

// ============================================================================
// TEMPLATE SELECTION
// ============================================================================

/**
 * Select the best starter templates based on calibration answers
 */
export async function selectStarterTemplates(
    answers: CalibrationAnswer[]
): Promise<StarterTemplate[]> {
    // Build score map
    const templateScores = new Map<string, number>()

    for (const answer of answers) {
        const question = CALIBRATION_QUESTIONS.find(q => q.id === answer.questionId)
        if (!question) continue

        const option = answer.selectedValue === question.optionA.value
            ? question.optionA
            : question.optionB

        for (const templateId of option.mapsToTemplates) {
            const current = templateScores.get(templateId) || 0
            templateScores.set(templateId, current + 1)
        }
    }

    // Sort by score and get top 2
    const sorted = [...templateScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)

    // Return matched templates
    return sorted
        .map(([id]) => STARTER_TEMPLATES.find(t => t.id === id))
        .filter((t): t is StarterTemplate => t !== undefined)
}

// ============================================================================
// APPLY STARTER TEMPLATE
// ============================================================================

/**
 * Apply a starter template to create a pre-populated collection
 */
export async function applyStarterTemplate(
    template: StarterTemplate
): Promise<{ success: boolean; categoryId?: string; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    try {
        return await db.transaction(async (tx) => {
            // 1. Create the category
            const [category] = await tx.insert(categories)
                .values({
                    name: template.name,
                    description: template.description,
                    emoji: template.emoji,
                    color: template.color,
                    userId,
                    isPublic: false,
                    sortOrder: 0
                })
                .returning()

            // 2. Create items from template
            for (let i = 0; i < template.items.length; i++) {
                const templateItem = template.items[i]

                // Upsert global item if externalId provided
                let globalItemId: string | null = null
                if (templateItem.externalId) {
                    const existing = await tx.query.globalItems.findFirst({
                        where: eq(globalItems.externalId, templateItem.externalId)
                    })

                    if (existing) {
                        globalItemId = existing.id
                    } else {
                        const [newGlobal] = await tx.insert(globalItems)
                            .values({
                                title: templateItem.name,
                                description: templateItem.description,
                                imageUrl: templateItem.imageUrl,
                                releaseYear: templateItem.releaseYear,
                                externalId: templateItem.externalId
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
                    name: templateItem.name,
                    description: templateItem.description,
                    image: templateItem.imageUrl,
                    tier: templateItem.defaultTier,
                    eloScore: 1200,
                    rank: i
                })
            }

            return { success: true, categoryId: category.id }
        })
    } catch (error) {
        console.error('Failed to apply starter template:', error)
        return { success: false, error: 'Failed to create collection' }
    }
}

// ============================================================================
// BINARY RATER VOTE
// ============================================================================

/**
 * Process a binary vote - creates collection and adds both items in one transaction
 */
export async function processBinaryVote(
    payload: BinaryRaterVotePayload
): Promise<BinaryRaterResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        throw new Error('Not authenticated')
    }

    return await db.transaction(async (tx) => {
        // 1. Create or find category
        let category = await tx.query.categories.findFirst({
            where: and(
                eq(categories.userId, userId),
                eq(categories.name, payload.theme)
            )
        })

        if (!category) {
            const [newCategory] = await tx.insert(categories)
                .values({
                    name: payload.theme,
                    userId,
                    description: `Your ${payload.theme} ranking`,
                    isPublic: false,
                    sortOrder: 0
                })
                .returning()
            category = newCategory
        }

        // 2. Create or find GlobalItems
        const globalA = await upsertGlobalItem(tx, payload.optionA)
        const globalB = await upsertGlobalItem(tx, payload.optionB)

        // 3. Create user items with initial ELO scores
        const WINNER_ELO = 1300
        const LOSER_ELO = 1100

        const isAWinner = payload.winnerId === 'A'

        const [winnerItem] = await tx.insert(items)
            .values({
                userId,
                categoryId: category.id,
                globalItemId: isAWinner ? globalA.id : globalB.id,
                name: isAWinner ? payload.optionA.name : payload.optionB.name,
                image: isAWinner ? payload.optionA.imageUrl : payload.optionB.imageUrl,
                description: isAWinner ? payload.optionA.description : payload.optionB.description,
                eloScore: WINNER_ELO,
                tier: 'A',
                rank: 0
            })
            .returning()

        const [loserItem] = await tx.insert(items)
            .values({
                userId,
                categoryId: category.id,
                globalItemId: isAWinner ? globalB.id : globalA.id,
                name: isAWinner ? payload.optionB.name : payload.optionA.name,
                image: isAWinner ? payload.optionB.imageUrl : payload.optionA.imageUrl,
                description: isAWinner ? payload.optionB.description : payload.optionA.description,
                eloScore: LOSER_ELO,
                tier: 'B',
                rank: 1
            })
            .returning()

        return {
            success: true,
            categoryId: category.id,
            winnerItemId: winnerItem.id,
            loserItemId: loserItem.id
        }
    })
}

// Helper: Upsert global item
async function upsertGlobalItem(tx: any, item: BinaryRaterItem) {
    if (item.externalId) {
        const existing = await tx.query.globalItems.findFirst({
            where: eq(globalItems.externalId, item.externalId)
        })
        if (existing) return existing
    }

    const [newGlobal] = await tx.insert(globalItems)
        .values({
            title: item.name,
            description: item.description,
            imageUrl: item.imageUrl,
            releaseYear: item.releaseYear,
            externalId: item.externalId
        })
        .returning()

    return newGlobal
}

// ============================================================================
// ONBOARDING STATE MANAGEMENT
// ============================================================================

/**
 * Save calibration answers and mark calibration complete
 */
export async function saveCalibrationAnswers(
    answers: CalibrationAnswer[]
): Promise<{ success: boolean; templates: StarterTemplate[] }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, templates: [] }
    }

    // Get matching templates
    const templates = await selectStarterTemplates(answers)

    // Apply each template
    for (const template of templates) {
        await applyStarterTemplate(template)
    }

    return { success: true, templates }
}

/**
 * Check if user has completed onboarding
 */
export async function checkOnboardingStatus(): Promise<{
    isComplete: boolean
    hasCollections: boolean
}> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { isComplete: false, hasCollections: false }
    }

    // Check if user has any collections
    const userCategories = await db.query.categories.findMany({
        where: eq(categories.userId, userId),
        limit: 1
    })

    const hasCollections = userCategories.length > 0

    return {
        isComplete: hasCollections,
        hasCollections
    }
}

/**
 * Mark onboarding as complete
 */
export async function completeOnboarding(): Promise<{ success: boolean }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false }
    }

    // Could update a user flag here if needed
    // For now, we consider onboarding complete if they have at least one collection
    return { success: true }
}
