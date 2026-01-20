import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

export type TypedSupabaseClient = SupabaseClient<Database>

export const createTypedQuery = (client: SupabaseClient) => {
    const typedClient = client as TypedSupabaseClient
    return {
        items: () => typedClient.from('items'),
        globalItems: () => typedClient.from('global_items'),
        categories: () => typedClient.from('categories'),
        profiles: () => typedClient.from('profiles'),
        reports: () => typedClient.from('reports'),
        invites: () => typedClient.from('invites'),
        activities: () => typedClient.from('activities'),
    }
}
