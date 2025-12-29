'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// ============================================================================
// TEMPLATE LOGIC (Legacy/Cloning)
// ============================================================================

export async function getChallengeTemplates() {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('categories') as any)
        .select('*')
        .eq('is_template', true)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function acceptChallengeTemplate(templateId: string) {
    const session = await getSession()
    if (!session?.user?.id) throw new Error("Unauthorized")
    const userId = session.user.id
    const supabase = await createClient()

    // 1. Fetch Template
    const { data: template } = await (supabase.from('categories') as any)
        .select('*')
        .eq('id', templateId)
        .single()

    if (!template || !template.is_template) throw new Error("Challenge template not found")

    // 2. Create User Category (Clone)
    const { data: newCategory, error: insertError } = await (supabase.from('categories') as any)
        .insert({
            name: template.name,
            description: template.description,
            image: template.image,
            color: template.color,
            emoji: template.emoji,
            metadata: template.metadata,
            user_id: userId,
            is_template: false,
            is_public: true,
        })
        .select()
        .single()

    if (insertError) throw insertError

    // 3. Clone Items from Template
    const { data: templateItems } = await (supabase.from('items') as any)
        .select('*')
        .eq('category_id', templateId)

    if (templateItems && templateItems.length > 0) {
        await (supabase.from('items') as any).insert(
            templateItems.map((ti: any) => ({
                name: ti.name,
                description: ti.description,
                image: ti.image,
                metadata: ti.metadata,
                global_item_id: ti.global_item_id,
                user_id: userId,
                category_id: newCategory.id,
                elo_score: 1200,
                status: 'ACTIVE'
            }))
        )
    }

    revalidatePath('/')
    revalidatePath(`/categories/${newCategory.id}`)
    return { categoryId: newCategory.id }
}

export async function toggleCategoryTemplate(categoryId: string, isTemplate: boolean) {
    const session = await getSession()
    if (session?.profile?.role !== 'ADMIN') throw new Error("Admin access required")

    const supabase = await createClient()

    await (supabase.from('categories') as any)
        .update({ is_template: isTemplate })
        .eq('id', categoryId)

    revalidatePath('/admin')
    revalidatePath(`/categories/${categoryId}`)
}

// ============================================================================
// COMMUNITY CHALLENGE LOGIC (Join/Progress)
// ============================================================================

export async function toggleCategoryChallenge(categoryId: string, isChallenge: boolean) {
    const session = await getSession()
    if (!session?.user?.id || session.profile?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    const supabase = await createClient()

    await (supabase.from('categories') as any)
        .update({ is_challenge: isChallenge })
        .eq('id', categoryId)

    revalidatePath('/admin')
    revalidatePath('/browse')
}

export async function joinChallenge(categoryId: string) {
    const session = await getSession()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const userId = session.user.id
    const supabase = await createClient()

    const { data: category } = await (supabase.from('categories') as any)
        .select('*')
        .eq('id', categoryId)
        .eq('is_challenge', true)
        .single()

    if (!category) throw new Error("Challenge not available")

    // Get category items
    const { data: categoryItems } = await (supabase.from('items') as any)
        .select('id, global_item_id')
        .eq('category_id', categoryId)

    const itemsList = categoryItems || []
    let progress = 0
    const globalIds = itemsList.map((i: any) => i.global_item_id).filter(Boolean) as string[]

    if (globalIds.length > 0) {
        // Count user's rated items with matching global IDs
        const { data: userItems } = await (supabase.from('items') as any)
            .select('id, global_item_id, ratings(id)')
            .eq('user_id', userId)
            .in('global_item_id', globalIds)

        progress = (userItems || []).filter((i: any) => i.ratings && i.ratings.length > 0).length
    }

    const status = (itemsList.length > 0 && progress >= itemsList.length) ? 'COMPLETED' : 'ACTIVE'
    const completedAt = status === 'COMPLETED' ? new Date().toISOString() : null

    await (supabase.from('user_challenges') as any)
        .upsert({
            user_id: userId,
            category_id: categoryId,
            status,
            progress,
            completed_at: completedAt,
            joined_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id,category_id'
        })

    revalidatePath(`/categories/${categoryId}`)
    revalidatePath('/profile')
}

export async function leaveChallenge(categoryId: string) {
    const session = await getSession()
    if (!session?.user?.id) throw new Error("Unauthorized")

    const supabase = await createClient()

    await (supabase.from('user_challenges') as any)
        .delete()
        .eq('user_id', session.user.id)
        .eq('category_id', categoryId)

    revalidatePath(`/categories/${categoryId}`)
    revalidatePath('/profile')
}

export async function updateChallengeProgress(userId: string, categoryId: string) {
    const supabase = await createClient()

    const { data: challenge } = await (supabase.from('user_challenges') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .single()

    if (!challenge) return

    const { data: categoryItems } = await (supabase.from('items') as any)
        .select('global_item_id')
        .eq('category_id', categoryId)

    const itemsList = categoryItems || []
    const globalIds = itemsList.map((i: any) => i.global_item_id).filter(Boolean) as string[]
    let progress = 0

    if (globalIds.length > 0) {
        const { data: userItems } = await (supabase.from('items') as any)
            .select('id, global_item_id, ratings(id)')
            .eq('user_id', userId)
            .in('global_item_id', globalIds)

        progress = (userItems || []).filter((i: any) => i.ratings && i.ratings.length > 0).length
    }

    const status = (itemsList.length > 0 && progress >= itemsList.length) ? 'COMPLETED' : 'ACTIVE'
    const completedAt = status === 'COMPLETED' ? new Date().toISOString() : null

    if (challenge.progress !== progress || challenge.status !== status) {
        await (supabase.from('user_challenges') as any)
            .update({ progress, status, completed_at: completedAt })
            .eq('user_id', userId)
            .eq('category_id', categoryId)

        revalidatePath('/profile')
    }
}

export async function getJoinedChallenges(userId: string) {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('user_challenges') as any)
        .select(`
            *,
            category:categories(*, items(id))
        `)
        .eq('user_id', userId)

    if (error) throw error
    return data || []
}

export async function getChallengeStatus(userId: string, categoryId: string) {
    const supabase = await createClient()

    const { data } = await supabase
        .from('user_challenges')
        .select('status, progress')
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .single()

    return data
}
