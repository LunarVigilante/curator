/**
 * Supabase Database Types
 * 
 * This is a placeholder file. For full type safety, generate types from Supabase:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/types/database.ts
 * 
 * Or use the Supabase Dashboard: Settings > API > Generate Types
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    email: string
                    name: string | null
                    display_name: string | null
                    image: string | null
                    bio: string | null
                    cover_image: string | null
                    is_public: boolean
                    profile_views: number
                    preferences: Json | null
                    role: 'USER' | 'ADMIN' | 'MODERATOR'
                    is_locked_out: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    email: string
                    name?: string | null
                    display_name?: string | null
                    image?: string | null
                    bio?: string | null
                    cover_image?: string | null
                    is_public?: boolean
                    profile_views?: number
                    preferences?: Json | null
                    role?: 'USER' | 'ADMIN' | 'MODERATOR'
                    is_locked_out?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    email?: string
                    name?: string | null
                    display_name?: string | null
                    image?: string | null
                    bio?: string | null
                    cover_image?: string | null
                    is_public?: boolean
                    profile_views?: number
                    preferences?: Json | null
                    role?: 'USER' | 'ADMIN' | 'MODERATOR'
                    is_locked_out?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            categories: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    image: string | null
                    color: string | null
                    emoji: string | null
                    sort_order: number
                    metadata: Json | null
                    is_template: boolean
                    is_challenge: boolean
                    is_public: boolean
                    is_featured: boolean
                    cached_analysis: Json | null
                    analysis_hash: string | null
                    user_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    image?: string | null
                    color?: string | null
                    emoji?: string | null
                    sort_order?: number
                    metadata?: Json | null
                    is_template?: boolean
                    is_challenge?: boolean
                    is_public?: boolean
                    is_featured?: boolean
                    cached_analysis?: Json | null
                    analysis_hash?: string | null
                    user_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    image?: string | null
                    color?: string | null
                    emoji?: string | null
                    sort_order?: number
                    metadata?: Json | null
                    is_template?: boolean
                    is_challenge?: boolean
                    is_public?: boolean
                    is_featured?: boolean
                    cached_analysis?: Json | null
                    analysis_hash?: string | null
                    user_id?: string | null
                    created_at?: string
                }
            }
            global_items: {
                Row: {
                    id: string
                    external_id: string | null
                    external_ids: Json | null
                    source: string | null
                    title: string
                    description: string | null
                    image_url: string | null
                    release_year: number | null
                    metadata: Json | null
                    cached_tags: Json | null
                    category_type: string | null
                    vector_text: string | null
                    last_metadata_update: string | null

                    // Board Games
                    min_players: number | null
                    max_players: number | null
                    min_playtime: number | null
                    max_playtime: number | null
                    min_age: number | null
                    mechanics: string[] | null
                    categories: string[] | null
                    complexity: number | null
                    designers: string[] | null
                    artists: string[] | null
                    publishers: string[] | null
                    is_expansion: boolean | null
                    bgg_id: number | null

                    created_at: string
                }
                Insert: {
                    id?: string
                    external_id?: string | null
                    external_ids?: Json | null
                    source?: string | null
                    title: string
                    description?: string | null
                    image_url?: string | null
                    release_year?: number | null
                    metadata?: Json | null
                    cached_tags?: Json | null
                    category_type?: string | null
                    vector_text?: string | null
                    last_metadata_update?: string | null

                    // Board Games
                    min_players?: number | null
                    max_players?: number | null
                    min_playtime?: number | null
                    max_playtime?: number | null
                    min_age?: number | null
                    mechanics?: string[] | null
                    categories?: string[] | null
                    complexity?: number | null
                    designers?: string[] | null
                    artists?: string[] | null
                    publishers?: string[] | null
                    is_expansion?: boolean | null
                    bgg_id?: number | null

                    created_at?: string
                }
                Update: {
                    id?: string
                    external_id?: string | null
                    external_ids?: Json | null
                    source?: string | null
                    title?: string
                    description?: string | null
                    image_url?: string | null
                    release_year?: number | null
                    metadata?: Json | null
                    cached_tags?: Json | null
                    category_type?: string | null
                    vector_text?: string | null
                    last_metadata_update?: string | null

                    // Board Games
                    min_players?: number | null
                    max_players?: number | null
                    min_playtime?: number | null
                    max_playtime?: number | null
                    min_age?: number | null
                    mechanics?: string[] | null
                    categories?: string[] | null
                    complexity?: number | null
                    designers?: string[] | null
                    artists?: string[] | null
                    publishers?: string[] | null
                    is_expansion?: boolean | null
                    bgg_id?: number | null

                    created_at?: string
                }
            }
            items: {
                Row: {
                    id: string
                    name: string | null
                    description: string | null
                    image: string | null
                    metadata: Json | null
                    status: 'ACTIVE' | 'IGNORED' | 'WISHLIST' | 'SEEN'
                    tier: string | null
                    rank: number | null
                    notes: string | null
                    elo_score: number
                    global_item_id: string | null
                    user_id: string | null
                    category_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name?: string | null
                    description?: string | null
                    image?: string | null
                    metadata?: Json | null
                    status?: 'ACTIVE' | 'IGNORED' | 'WISHLIST' | 'SEEN'
                    tier?: string | null
                    rank?: number | null
                    notes?: string | null
                    elo_score?: number
                    global_item_id?: string | null
                    user_id?: string | null
                    category_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string | null
                    description?: string | null
                    image?: string | null
                    metadata?: Json | null
                    status?: 'ACTIVE' | 'IGNORED' | 'WISHLIST' | 'SEEN'
                    tier?: string | null
                    rank?: number | null
                    notes?: string | null
                    elo_score?: number
                    global_item_id?: string | null
                    user_id?: string | null
                    category_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            ratings: {
                Row: {
                    id: string
                    value: number
                    tier: string | null
                    custom_rank: string | null
                    type: 'NUMERICAL' | 'TIER' | 'HYBRID'
                    item_id: string
                    user_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    value: number
                    tier?: string | null
                    custom_rank?: string | null
                    type: 'NUMERICAL' | 'TIER' | 'HYBRID'
                    item_id: string
                    user_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    value?: number
                    tier?: string | null
                    custom_rank?: string | null
                    type?: 'NUMERICAL' | 'TIER' | 'HYBRID'
                    item_id?: string
                    user_id?: string
                    created_at?: string
                }
            }
            system_settings: {
                Row: {
                    key: string
                    value: string
                    category: string
                    is_secret: boolean
                    updated_at: string
                }
                Insert: {
                    key: string
                    value: string
                    category: string
                    is_secret?: boolean
                    updated_at?: string
                }
                Update: {
                    key?: string
                    value?: string
                    category?: string
                    is_secret?: boolean
                    updated_at?: string
                }
            }
            invites: {
                Row: {
                    id: string
                    code: string
                    is_used: boolean
                    created_at: string
                    used_at: string | null
                    created_by: string
                    used_by: string | null
                }
                Insert: {
                    id?: string
                    code: string
                    is_used?: boolean
                    created_at?: string
                    used_at?: string | null
                    created_by: string
                    used_by?: string | null
                }
                Update: {
                    id?: string
                    code?: string
                    is_used?: boolean
                    created_at?: string
                    used_at?: string | null
                    created_by?: string
                    used_by?: string | null
                }
            }
            collection_tags: {
                Row: {
                    id: string
                    tag: string
                    is_admin_only: boolean
                    category_id: string
                    added_by: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    tag: string
                    is_admin_only?: boolean
                    category_id: string
                    added_by?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    tag?: string
                    is_admin_only?: boolean
                    category_id?: string
                    added_by?: string | null
                    created_at?: string
                }
            },
            tags: {
                Row: {
                    id: string
                    name: string
                },
                Insert: {
                    id?: string
                    name: string
                },
                Update: {
                    id?: string
                    name?: string
                }
            },
            activities: {
                Row: {
                    id: string
                    user_id: string
                    type: string
                    data: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    type: string
                    data: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    type?: string
                    data?: Json
                    created_at?: string
                }
            },
            email_templates: {
                Row: {
                    id: string
                    name: string
                    subject: string
                    body_html: string
                    variables: Json
                    created_at: string
                    last_updated: string
                }
                Insert: {
                    id?: string
                    name: string
                    subject: string
                    body_html: string
                    variables: Json
                    created_at?: string
                    last_updated?: string
                }
                Update: {
                    id?: string
                    name?: string
                    subject?: string
                    body_html?: string
                    variables?: Json
                    created_at?: string
                    last_updated?: string
                }
            }
        },
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            user_role: 'USER' | 'ADMIN' | 'MODERATOR'
            item_status: 'ACTIVE' | 'IGNORED' | 'WISHLIST' | 'SEEN'
            rating_type: 'NUMERICAL' | 'TIER' | 'HYBRID'
        }
    }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Shorthand types
export type Profile = Tables<'profiles'>
export type Category = Tables<'categories'>
export type GlobalItem = Tables<'global_items'>
export type Item = Tables<'items'>
export type Rating = Tables<'ratings'>
export type SystemSetting = Tables<'system_settings'>
