'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

export async function getCommonGround(partnerId: string, categoryId: string) {
    const session = await getSession()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id
    const supabase = await createClient()

    // 1. Fetch User A items
    const { data: userAItems } = await (supabase.from('items') as any)
        .select(`
            id,
            name,
            image,
            elo_score,
            global_item_id,
            global_item:global_items(title, image_url)
        `)
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .not('global_item_id', 'is', null)

    // 2. Fetch User B items
    const { data: userBItems } = await (supabase.from('items') as any)
        .select(`
            id,
            name,
            image,
            elo_score,
            global_item_id,
            global_item:global_items(title, image_url)
        `)
        .eq('user_id', partnerId)
        .eq('category_id', categoryId)
        .not('global_item_id', 'is', null)

    // 3. Map B items by globalItemId for easy lookup
    const userBMap = new Map((userBItems || []).map((item: any) => [item.global_item_id, item]))

    // 4. Find intersection and compute composite score
    const commonItems = (userAItems || [])
        .filter((item: any) => userBMap.has(item.global_item_id))
        .map((itemA: any) => {
            const itemB = userBMap.get(itemA.global_item_id)! as any
            const compositeScore = ((itemA.elo_score || 1200) + (itemB.elo_score || 1200)) / 2

            return {
                id: itemA.global_item_id!,
                name: (itemA.global_item as any)?.title || itemA.name || 'Unknown',
                image: (itemA.global_item as any)?.image_url || itemA.image,
                userAScore: itemA.elo_score || 1200,
                userBScore: itemB.elo_score || 1200,
                compositeScore
            }
        })

    // 5. Sort by composite score and return top 10
    return commonItems
        .sort((a: any, b: any) => b.compositeScore - a.compositeScore)
        .slice(0, 10)
}
