'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/auth'
import {
    CALIBRATION_QUESTIONS,
    STARTER_TEMPLATES,
    BINARY_RATER_PAIRS,
    type CalibrationAnswer,
    type StarterTemplate,
    type BinaryRaterVotePayload,
    type BinaryRaterResult,
    type BinaryRaterItem
} from '@/lib/types/onboarding'

// ============================================================================
// TEMPLATE SELECTION
// ============================================================================

export async function selectStarterTemplates(
    answers: CalibrationAnswer[]
): Promise<StarterTemplate[]> {
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

    const sorted = [...templateScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)

    return sorted
        .map(([id]) => STARTER_TEMPLATES.find(t => t.id === id))
        .filter((t): t is StarterTemplate => t !== undefined)
}

// ============================================================================
// APPLY STARTER TEMPLATE
// ============================================================================

export async function applyStarterTemplate(
    template: StarterTemplate
): Promise<{ success: boolean; categoryId?: string; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    try {
        // Map categoryType to lowercase for provider
        const typeMap: Record<string, string> = {
            'MOVIE': 'movie',
            'TV': 'tv',
            'ANIME': 'anime',
            'GAME': 'game'
        }
        const contentType = typeMap[template.categoryType] || template.categoryType.toLowerCase()

        // 1. Create the category
        const { data: category, error: categoryError } = await (supabase.from('categories') as any)
            .insert({
                name: template.name,
                description: template.description,
                emoji: template.emoji,
                color: template.color,
                user_id: userId,
                is_public: false,
                sort_order: 0,
                metadata: JSON.stringify({ type: contentType })
            })
            .select()
            .single()

        if (categoryError) throw categoryError

        // 2. Create items from template
        for (let i = 0; i < template.items.length; i++) {
            const templateItem = template.items[i]

            let globalItemId: string | null = null
            if (templateItem.externalId) {
                const { data: existing } = await (supabase.from('global_items') as any)
                    .select('id')
                    .eq('external_id', templateItem.externalId)
                    .single()

                if (existing) {
                    globalItemId = existing.id
                } else {
                    const { data: newGlobal } = await (supabase.from('global_items') as any)
                        .insert({
                            title: templateItem.name,
                            description: templateItem.description,
                            image_url: templateItem.imageUrl,
                            release_year: templateItem.releaseYear,
                            external_id: templateItem.externalId
                        })
                        .select()
                        .single()
                    globalItemId = newGlobal?.id || null
                }
            }

            await (supabase.from('items') as any).insert({
                user_id: userId,
                category_id: category.id,
                global_item_id: globalItemId,
                name: templateItem.name,
                description: templateItem.description,
                image: templateItem.imageUrl,
                tier: templateItem.defaultTier,
                elo_score: 1200,
                rank: i
            })
        }

        return { success: true, categoryId: category.id }
    } catch (error) {
        console.error('Failed to apply starter template:', error)
        return { success: false, error: 'Failed to create collection' }
    }
}

// ============================================================================
// BINARY RATER VOTE
// ============================================================================

export async function processBinaryVote(
    payload: BinaryRaterVotePayload
): Promise<BinaryRaterResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        throw new Error('Not authenticated')
    }

    const supabase = await createClient()

    // 1. Create or find category
    const { data: existingCategory } = await (supabase.from('categories') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('name', payload.theme)
        .single()

    let category = existingCategory

    if (!category) {
        // Find the pair to get categoryType
        const pair = BINARY_RATER_PAIRS.find(p => p.theme === payload.theme)
        const typeMap: Record<string, string> = {
            'MOVIE': 'movie',
            'TV': 'tv',
            'ANIME': 'anime',
            'GAME': 'game'
        }
        const contentType = pair ? (typeMap[pair.categoryType] || pair.categoryType.toLowerCase()) : 'movie'

        const { data: newCategory, error } = await (supabase.from('categories') as any)
            .insert({
                name: payload.theme,
                user_id: userId,
                description: `Your ${payload.theme} ranking`,
                is_public: false,
                sort_order: 0,
                metadata: JSON.stringify({ type: contentType })
            })
            .select()
            .single()
        if (error) throw error
        category = newCategory
    }

    // 2. Create or find GlobalItems
    const globalA = await upsertGlobalItem(supabase, payload.optionA)
    const globalB = await upsertGlobalItem(supabase, payload.optionB)

    // 3. Create user items with initial ELO scores
    const WINNER_ELO = 1300
    const LOSER_ELO = 1100

    const isAWinner = payload.winnerId === 'A'

    const { data: winnerItem, error: winnerError } = await (supabase.from('items') as any)
        .insert({
            user_id: userId,
            category_id: category.id,
            global_item_id: isAWinner ? globalA.id : globalB.id,
            name: isAWinner ? payload.optionA.name : payload.optionB.name,
            image: isAWinner ? payload.optionA.imageUrl : payload.optionB.imageUrl,
            description: isAWinner ? payload.optionA.description : payload.optionB.description,
            elo_score: WINNER_ELO,
            tier: 'A',
            rank: 0
        })
        .select()
        .single()

    if (winnerError) throw winnerError

    const { data: loserItem, error: loserError } = await (supabase.from('items') as any)
        .insert({
            user_id: userId,
            category_id: category.id,
            global_item_id: isAWinner ? globalB.id : globalA.id,
            name: isAWinner ? payload.optionB.name : payload.optionA.name,
            image: isAWinner ? payload.optionB.imageUrl : payload.optionA.imageUrl,
            description: isAWinner ? payload.optionB.description : payload.optionA.description,
            elo_score: LOSER_ELO,
            tier: 'B',
            rank: 1
        })
        .select()
        .single()

    if (loserError) throw loserError

    return {
        success: true,
        categoryId: category.id,
        winnerItemId: winnerItem.id,
        loserItemId: loserItem.id
    }
}

// Helper: Upsert global item
async function upsertGlobalItem(supabase: any, item: BinaryRaterItem) {
    if (item.externalId) {
        const { data: existing } = await (supabase.from('global_items') as any)
            .select('*')
            .eq('external_id', item.externalId)
            .single()
        if (existing) return existing
    }

    const { data: newGlobal, error } = await (supabase.from('global_items') as any)
        .insert({
            title: item.name,
            description: item.description,
            image_url: item.imageUrl,
            release_year: item.releaseYear,
            external_id: item.externalId
        })
        .select()
        .single()

    if (error) throw error
    return newGlobal
}

// ============================================================================
// ONBOARDING STATE MANAGEMENT
// ============================================================================

export async function saveCalibrationAnswers(
    answers: CalibrationAnswer[]
): Promise<{ success: boolean; templates: StarterTemplate[] }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, templates: [] }
    }

    const templates = await selectStarterTemplates(answers)

    for (const template of templates) {
        await applyStarterTemplate(template)
    }

    return { success: true, templates }
}

export async function checkOnboardingStatus(): Promise<{
    isComplete: boolean
    hasCollections: boolean
}> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { isComplete: false, hasCollections: false }
    }

    const supabase = await createClient()

    const { data: userCategories } = await (supabase.from('categories') as any)
        .select('id')
        .eq('user_id', userId)
        .limit(1)

    const hasCollections = (userCategories?.length || 0) > 0

    return {
        isComplete: hasCollections,
        hasCollections
    }
}

export async function completeOnboarding(): Promise<{ success: boolean }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false }
    }

    return { success: true }
}
