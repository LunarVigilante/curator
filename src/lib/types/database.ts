export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            activities: {
                Row: {
                    created_at: string | null
                    data: Json
                    id: string
                    type: string
                    user_id: string
                }
                Insert: {
                    created_at?: string | null
                    data: Json
                    id?: string
                    type: string
                    user_id: string
                }
                Update: {
                    created_at?: string | null
                    data?: Json
                    id?: string
                    type?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "activities_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            categories: {
                Row: {
                    analysis_hash: string | null
                    cached_analysis: Json | null
                    color: string | null
                    created_at: string | null
                    description: string | null
                    emoji: string | null
                    id: string
                    image: string | null
                    is_challenge: boolean | null
                    is_featured: boolean | null
                    is_public: boolean | null
                    is_template: boolean | null
                    metadata: Json | null
                    name: string
                    sort_order: number | null
                    user_id: string | null
                }
                Insert: {
                    analysis_hash?: string | null
                    cached_analysis?: Json | null
                    color?: string | null
                    created_at?: string | null
                    description?: string | null
                    emoji?: string | null
                    id?: string
                    image?: string | null
                    is_challenge?: boolean | null
                    is_featured?: boolean | null
                    is_public?: boolean | null
                    is_template?: boolean | null
                    metadata?: Json | null
                    name: string
                    sort_order?: number | null
                    user_id?: string | null
                }
                Update: {
                    analysis_hash?: string | null
                    cached_analysis?: Json | null
                    color?: string | null
                    created_at?: string | null
                    description?: string | null
                    emoji?: string | null
                    id?: string
                    image?: string | null
                    is_challenge?: boolean | null
                    is_featured?: boolean | null
                    is_public?: boolean | null
                    is_template?: boolean | null
                    metadata?: Json | null
                    name?: string
                    sort_order?: number | null
                    user_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "categories_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            global_items: {
                Row: {
                    anilist_id: number | null
                    anilist_score: number | null
                    artists: string[] | null
                    awards_text: string | null
                    best_players: string | null
                    bgatlas_id: string | null
                    budget: number | null
                    cast: string[] | null
                    categories: string[] | null
                    category_type: string
                    complexity: number | null
                    context_metadata: Json | null
                    created_at: string
                    description: string | null
                    description_parts: Json | null
                    designers: string[] | null
                    developers: string[] | null
                    director: string | null
                    duration_ms: number | null
                    episodes: number | null
                    external_ids: Json | null
                    families: string[] | null
                    game_modes: string[] | null
                    genres: string[] | null
                    id: string
                    igdb_id: string | null
                    image_url: string | null
                    imdb_id: string | null
                    imdb_rating: string | null
                    keywords: string[] | null
                    label: string | null
                    max_age: number | null
                    max_players: number | null
                    max_playtime: number | null
                    mechanics: string[] | null
                    metacritic_rating: number | null
                    metadata: Json | null
                    min_age: number | null
                    min_age_community: number | null
                    min_players: number | null
                    min_playtime: number | null
                    original_countries: string[] | null
                    original_creator: string | null
                    original_language: string | null
                    original_title: string | null
                    platforms: Json | null
                    popularity: number | null
                    poster_path: string | null
                    publishers: string[] | null
                    rank_overall: number | null
                    release_date: string | null
                    release_year: number | null
                    revenue: number | null
                    romaji_title: string | null
                    rotten_tomatoes_rating: string | null
                    runtime: number | null
                    season: string | null
                    source_material: string | null
                    spotify_id: string | null
                    spotify_url: string | null
                    status: string | null
                    studio: string | null
                    tagline: string | null
                    themes: string[] | null
                    time_to_beat: Json | null
                    title: string
                    tmdb_id: number | null
                    total_tracks: number | null
                    trailer_url: string | null
                    tvdb_id: number | null
                    updated_at: string
                    url: string | null
                    vote_average: number | null
                    vote_count: number | null
                    year_published: number | null
                }
                Insert: {
                    anilist_id?: number | null
                    anilist_score?: number | null
                    artists?: string[] | null
                    awards_text?: string | null
                    best_players?: string | null
                    bgatlas_id?: string | null
                    budget?: number | null
                    cast?: string[] | null
                    categories?: string[] | null
                    category_type: string
                    complexity?: number | null
                    context_metadata?: Json | null
                    created_at?: string
                    description?: string | null
                    description_parts?: Json | null
                    designers?: string[] | null
                    developers?: string[] | null
                    director?: string | null
                    duration_ms?: number | null
                    episodes?: number | null
                    external_ids?: Json | null
                    families?: string[] | null
                    game_modes?: string[] | null
                    genres?: string[] | null
                    id?: string
                    igdb_id?: string | null
                    image_url?: string | null
                    imdb_id?: string | null
                    imdb_rating?: string | null
                    keywords?: string[] | null
                    label?: string | null
                    max_age?: number | null
                    max_players?: number | null
                    max_playtime?: number | null
                    mechanics?: string[] | null
                    metacritic_rating?: number | null
                    metadata?: Json | null
                    min_age?: number | null
                    min_age_community?: number | null
                    min_players?: number | null
                    min_playtime?: number | null
                    original_countries?: string[] | null
                    original_creator?: string | null
                    original_language?: string | null
                    original_title?: string | null
                    platforms?: Json | null
                    popularity?: number | null
                    poster_path?: string | null
                    publishers?: string[] | null
                    rank_overall?: number | null
                    release_date?: string | null
                    release_year?: number | null
                    revenue?: number | null
                    romaji_title?: string | null
                    rotten_tomatoes_rating?: string | null
                    runtime?: number | null
                    season?: string | null
                    source_material?: string | null
                    spotify_id?: string | null
                    spotify_url?: string | null
                    status?: string | null
                    studio?: string | null
                    tagline?: string | null
                    themes?: string[] | null
                    time_to_beat?: Json | null
                    title: string
                    tmdb_id?: number | null
                    total_tracks?: number | null
                    trailer_url?: string | null
                    tvdb_id?: number | null
                    updated_at?: string
                    url?: string | null
                    vote_average?: number | null
                    vote_count?: number | null
                    year_published?: number | null
                }
                Update: {
                    anilist_id?: number | null
                    anilist_score?: number | null
                    artists?: string[] | null
                    awards_text?: string | null
                    best_players?: string | null
                    bgatlas_id?: string | null
                    budget?: number | null
                    cast?: string[] | null
                    categories?: string[] | null
                    category_type?: string
                    complexity?: number | null
                    context_metadata?: Json | null
                    created_at?: string
                    description?: string | null
                    description_parts?: Json | null
                    designers?: string[] | null
                    developers?: string[] | null
                    director?: string | null
                    duration_ms?: number | null
                    episodes?: number | null
                    external_ids?: Json | null
                    families?: string[] | null
                    game_modes?: string[] | null
                    genres?: string[] | null
                    id?: string
                    igdb_id?: string | null
                    image_url?: string | null
                    imdb_id?: string | null
                    imdb_rating?: string | null
                    keywords?: string[] | null
                    label?: string | null
                    max_age?: number | null
                    max_players?: number | null
                    max_playtime?: number | null
                    mechanics?: string[] | null
                    metacritic_rating?: number | null
                    metadata?: Json | null
                    min_age?: number | null
                    min_age_community?: number | null
                    min_players?: number | null
                    min_playtime?: number | null
                    original_countries?: string[] | null
                    original_creator?: string | null
                    original_language?: string | null
                    original_title?: string | null
                    platforms?: Json | null
                    popularity?: number | null
                    poster_path?: string | null
                    publishers?: string[] | null
                    rank_overall?: number | null
                    release_date?: string | null
                    release_year?: number | null
                    revenue?: number | null
                    romaji_title?: string | null
                    rotten_tomatoes_rating?: string | null
                    runtime?: number | null
                    season?: string | null
                    source_material?: string | null
                    spotify_id?: string | null
                    spotify_url?: string | null
                    status?: string | null
                    studio?: string | null
                    tagline?: string | null
                    themes?: string[] | null
                    time_to_beat?: Json | null
                    title?: string
                    tmdb_id?: number | null
                    total_tracks?: number | null
                    trailer_url?: string | null
                    tvdb_id?: number | null
                    updated_at?: string
                    url?: string | null
                    vote_average?: number | null
                    vote_count?: number | null
                    year_published?: number | null
                }
                Relationships: []
            }
            invites: {
                Row: {
                    code: string
                    created_at: string
                    id: string
                    is_active: boolean
                    is_used: boolean
                    max_uses: number
                    use_count: number
                    used_at: string | null
                    used_by: string | null
                }
                Insert: {
                    code: string
                    created_at?: string
                    id?: string
                    is_active?: boolean
                    is_used?: boolean
                    max_uses?: number
                    use_count?: number
                    used_at?: string | null
                    used_by?: string | null
                }
                Update: {
                    code?: string
                    created_at?: string
                    id?: string
                    is_active?: boolean
                    is_used?: boolean
                    max_uses?: number
                    use_count?: number
                    used_at?: string | null
                    used_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "invites_used_by_fkey"
                        columns: ["used_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            items: {
                Row: {
                    cached_tags: Json | null
                    category_id: string | null
                    category_type: string | null
                    column_values: Json | null
                    created_at: string
                    creator_id: string | null
                    description: string | null
                    global_item_id: string | null
                    id: string
                    image: string | null
                    metadata: Json | null
                    name: string
                    notes: string | null
                    rank: number | null
                    tier: string | null
                    updated_at: string
                    url: string | null
                    user_id: string
                }
                Insert: {
                    cached_tags?: Json | null
                    category_id?: string | null
                    category_type?: string | null
                    column_values?: Json | null
                    created_at?: string
                    creator_id?: string | null
                    description?: string | null
                    global_item_id?: string | null
                    id?: string
                    image?: string | null
                    metadata?: Json | null
                    name: string
                    notes?: string | null
                    rank?: number | null
                    tier?: string | null
                    updated_at?: string
                    url?: string | null
                    user_id: string
                }
                Update: {
                    cached_tags?: Json | null
                    category_id?: string | null
                    category_type?: string | null
                    column_values?: Json | null
                    created_at?: string
                    creator_id?: string | null
                    description?: string | null
                    global_item_id?: string | null
                    id?: string
                    image?: string | null
                    metadata?: Json | null
                    name?: string
                    notes?: string | null
                    rank?: number | null
                    tier?: string | null
                    updated_at?: string
                    url?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "items_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "items_global_item_id_fkey"
                        columns: ["global_item_id"]
                        isOneToOne: false
                        referencedRelation: "global_items"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "items_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    avatar_url: string | null
                    bio: string | null
                    created_at: string
                    display_name: string | null
                    email: string | null
                    id: string
                    name: string | null
                    role: Database["public"]["Enums"]["user_role"]
                    theme: string | null
                    updated_at: string
                }
                Insert: {
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string
                    display_name?: string | null
                    email?: string | null
                    id: string
                    name?: string | null
                    role?: Database["public"]["Enums"]["user_role"]
                    theme?: string | null
                    updated_at?: string
                }
                Update: {
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string
                    display_name?: string | null
                    email?: string | null
                    id?: string
                    name?: string | null
                    role?: Database["public"]["Enums"]["user_role"]
                    theme?: string | null
                    updated_at?: string
                }
                Relationships: []
            }
            reports: {
                Row: {
                    category_type: string | null
                    created_at: string
                    details: string | null
                    global_item_id: string
                    id: string
                    reason: Database["public"]["Enums"]["report_reason"]
                    resolved_at: string | null
                    resolved_by: string | null
                    status: Database["public"]["Enums"]["report_status"]
                    user_id: string
                }
                Insert: {
                    category_type?: string | null
                    created_at?: string
                    details?: string | null
                    global_item_id: string
                    id?: string
                    reason: Database["public"]["Enums"]["report_reason"]
                    resolved_at?: string | null
                    resolved_by?: string | null
                    status?: Database["public"]["Enums"]["report_status"]
                    user_id: string
                }
                Update: {
                    category_type?: string | null
                    created_at?: string
                    details?: string | null
                    global_item_id?: string
                    id?: string
                    reason?: Database["public"]["Enums"]["report_reason"]
                    resolved_at?: string | null
                    resolved_by?: string | null
                    status?: Database["public"]["Enums"]["report_status"]
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "reports_global_item_id_fkey"
                        columns: ["global_item_id"]
                        isOneToOne: false
                        referencedRelation: "global_items"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "reports_resolved_by_fkey"
                        columns: ["resolved_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "reports_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_user_stats_analytics: {
                Args: {
                    target_user_id: string
                }
                Returns: {
                    total_items: number
                    total_categories: number
                    items_by_category: Json
                    items_by_month: Json
                    tier_distribution: Json
                    top_tags: Json
                    status_distribution: Json
                }[]
            }
        }
        Enums: {
            item_status: "ACTIVE" | "IGNORED" | "WISHLIST" | "SEEN"
            notification_type:
            | "admin_report_alert"
            | "user_follow"
            | "item_update"
            | "report_resolved"
            rank_sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE"
            rank_type: "RANKED" | "UTILITY"
            rating_type: "NUMERICAL" | "TIER" | "HYBRID"
            report_reason: "inaccurate_data" | "duplicate" | "inappropriate" | "other"
            report_status: "pending" | "resolved" | "dismissed"
            user_role: "USER" | "ADMIN" | "MODERATOR"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

// Type alias for Profile table row
export type Profile = PublicSchema["Tables"]["profiles"]["Row"]

export type Tables<
    TableName extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])
> = (PublicSchema["Tables"] & PublicSchema["Views"])[TableName] extends {
    Row: infer R
}
    ? R
    : never

export type TablesInsert<
    TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName] extends {
    Insert: infer I
}
    ? I
    : never

export type TablesUpdate<
    TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName] extends {
    Update: infer U
}
    ? U
    : never

export type Enums<
    EnumName extends keyof PublicSchema["Enums"]
> = PublicSchema["Enums"][EnumName]

export type CompositeTypes<
    CompositeTypeName extends keyof PublicSchema["CompositeTypes"]
> = PublicSchema["CompositeTypes"][CompositeTypeName]

