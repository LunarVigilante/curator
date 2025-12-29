'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/types/database'

export type ActivityType = 'RANKED_ITEM' | 'CREATED_LIST' | 'FOLLOWED_USER'

export async function logActivity(userId: string, type: ActivityType, data: any) {
    try {
        const supabase = await createClient() as SupabaseClient<Database>
        await (supabase.from('activities') as any).insert({
            type,
            data,
        } as any)
    } catch (error) {
        console.error("Failed to log activity:", error)
        // Fail silently to not block main user action
    }
}

export async function getRecentActivities(limit: number = 20) {
    const supabase = await createClient() as SupabaseClient<Database>

    const { data, error } = await (supabase.from('activities') as any)
        .select('*, user:profiles(*)')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return data || []
}
