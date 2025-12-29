'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/auth'
import { nanoid } from 'nanoid'

// ============================================================================
// Share Card Types
// ============================================================================

export type ShareCardData = {
    id: string
    shareHash: string
    template: string
    imageUrl: string | null
    viewCount: number
    createdAt: Date
    category: {
        id: string
        name: string
        emoji: string | null
        color: string | null
    }
    curator: {
        id: string
        name: string
        displayName: string | null
        image: string | null
    }
    topItems: {
        id: string
        name: string
        image: string | null
        tier: string | null
    }[]
}

export type ShareTemplate = 'default' | 'instagram' | 'twitter'

// ============================================================================
// Share Actions
// ============================================================================

/**
 * Generate or get existing share card for a collection
 */
export async function generateShareCard(
    categoryId: string,
    template: ShareTemplate = 'default'
): Promise<{ success: boolean; error?: string; shareCard?: ShareCardData }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    // Verify category ownership
    const { data: category, error: categoryError } = await (supabase.from('categories') as any)
        .select('id, name, emoji, color, user_id')
        .eq('id', categoryId)
        .single()

    if (categoryError || !category) {
        return { success: false, error: 'Collection not found' }
    }

    if (category.user_id !== userId) {
        return { success: false, error: 'Only the collection owner can create share cards' }
    }

    // Check for existing share card with same template
    const { data: existing } = await (supabase.from('share_cards') as any)
        .select('*')
        .eq('category_id', categoryId)
        .eq('template', template)
        .single()

    // Get curator info
    const { data: curator } = await (supabase.from('profiles') as any)
        .select('id, name, display_name, image')
        .eq('id', userId)
        .single()

    // Get top 3 items (S tier or highest ELO)
    // Note: This uses a simpler approach since Supabase doesn't support complex SQL in select
    const { data: topItemsRaw } = await (supabase.from('items') as any)
        .select('id, name, image, tier, elo_score, global_item:global_items(title, image_url)')
        .eq('category_id', categoryId)
        .order('elo_score', { ascending: false })
        .limit(10) // Get more and filter client-side for tier priority

    // Sort by tier priority (S > A > others) then ELO
    const tierPriority: Record<string, number> = { 'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 }
    const sortedItems = (topItemsRaw || [])
        .sort((a: any, b: any) => {
            const aPriority = tierPriority[a.tier || ''] ?? 99
            const bPriority = tierPriority[b.tier || ''] ?? 99
            if (aPriority !== bPriority) return aPriority - bPriority
            return (b.elo_score || 0) - (a.elo_score || 0)
        })
        .slice(0, 3)

    const topItems = sortedItems.map((item: any) => ({
        id: item.id,
        name: (item.global_item as any)?.title || item.name || 'Untitled',
        image: (item.global_item as any)?.image_url || item.image,
        tier: item.tier,
    }))

    if (existing) {
        // Return existing share card with fresh data
        return {
            success: true,
            shareCard: {
                id: existing.id,
                shareHash: existing.share_hash,
                template: existing.template,
                imageUrl: existing.image_url,
                viewCount: existing.view_count,
                createdAt: new Date(existing.created_at),
                category: {
                    id: category.id,
                    name: category.name,
                    emoji: category.emoji,
                    color: category.color,
                },
                curator: {
                    id: curator!.id,
                    name: curator!.name,
                    displayName: curator!.display_name,
                    image: curator!.image,
                },
                topItems,
            }
        }
    }

    // Create new share card
    try {
        const shareHash = nanoid(10) // Short unique ID for URL
        const metadata = JSON.stringify({
            top3ItemIds: topItems.map((i: any) => i.id),
            title: category.name,
            curatorName: curator?.display_name || curator?.name,
            generatedAt: new Date().toISOString(),
        })

        const { data: newCard, error: insertError } = await (supabase.from('share_cards') as any)
            .insert({
                category_id: categoryId,
                user_id: userId,
                share_hash: shareHash,
                template,
                metadata,
            })
            .select()
            .single()

        if (insertError || !newCard) throw insertError

        return {
            success: true,
            shareCard: {
                id: newCard.id,
                shareHash: newCard.share_hash,
                template: newCard.template,
                imageUrl: newCard.image_url,
                viewCount: newCard.view_count,
                createdAt: new Date(newCard.created_at),
                category: {
                    id: category.id,
                    name: category.name,
                    emoji: category.emoji,
                    color: category.color,
                },
                curator: {
                    id: curator!.id,
                    name: curator!.name,
                    displayName: curator!.display_name,
                    image: curator!.image,
                },
                topItems,
            }
        }
    } catch (error) {
        console.error('Failed to create share card:', error)
        return { success: false, error: 'Failed to create share card' }
    }
}

/**
 * Get share card by hash (public, no auth required)
 */
export async function getShareCardByHash(shareHash: string): Promise<ShareCardData | null> {
    const supabase = await createClient()

    const { data: card, error } = await (supabase.from('share_cards') as any)
        .select('*')
        .eq('share_hash', shareHash)
        .single()

    if (error || !card) return null

    // Increment view count
    await (supabase.from('share_cards') as any)
        .update({ view_count: card.view_count + 1 })
        .eq('id', card.id)

    // Get category
    const { data: category } = await (supabase.from('categories') as any)
        .select('id, name, emoji, color')
        .eq('id', card.category_id)
        .single()

    if (!category) return null

    // Get curator
    const { data: curator } = await (supabase.from('profiles') as any)
        .select('id, name, display_name, image')
        .eq('id', card.user_id)
        .single()

    if (!curator) return null

    // Get top items
    const { data: topItemsRaw } = await (supabase.from('items') as any)
        .select('id, name, image, tier, elo_score, global_item:global_items(title, image_url)')
        .eq('category_id', card.category_id)
        .order('elo_score', { ascending: false })
        .limit(10)

    const tierPriority: Record<string, number> = { 'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 }
    const sortedItems = (topItemsRaw || [])
        .sort((a: any, b: any) => {
            const aPriority = tierPriority[a.tier || ''] ?? 99
            const bPriority = tierPriority[b.tier || ''] ?? 99
            if (aPriority !== bPriority) return aPriority - bPriority
            return (b.elo_score || 0) - (a.elo_score || 0)
        })
        .slice(0, 3)

    const topItems = sortedItems.map((item: any) => ({
        id: item.id,
        name: (item.global_item as any)?.title || item.name || 'Untitled',
        image: (item.global_item as any)?.image_url || item.image,
        tier: item.tier,
    }))

    return {
        id: card.id,
        shareHash: card.share_hash,
        template: card.template,
        imageUrl: card.image_url,
        viewCount: card.view_count + 1,
        createdAt: new Date(card.created_at),
        category: {
            id: category.id,
            name: category.name,
            emoji: category.emoji,
            color: category.color,
        },
        curator: {
            id: curator.id,
            name: curator.name,
            displayName: curator.display_name,
            image: curator.image,
        },
        topItems,
    }
}

/**
 * Delete a share card
 */
export async function deleteShareCard(shareHash: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    const { data: card } = await (supabase.from('share_cards') as any)
        .select('id, user_id')
        .eq('share_hash', shareHash)
        .single()

    if (!card || card.user_id !== userId) {
        return { success: false, error: 'Share card not found or not authorized' }
    }

    try {
        await (supabase.from('share_cards') as any).delete().eq('id', card.id)
        return { success: true }
    } catch (error) {
        console.error('Failed to delete share card:', error)
        return { success: false, error: 'Failed to delete share card' }
    }
}
