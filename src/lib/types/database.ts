export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    graphql_public: {
        Tables: {
            [_ in never]: never
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            graphql: {
                Args: {
                    extensions?: Json
                    operationName?: string
                    query?: string
                    variables?: Json
                }
                Returns: Json
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
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
            cohort_averages: {
                Row: {
                    avg_value: number
                    category_id: string | null
                    cohort_type: string
                    computed_at: string | null
                    id: string
                    metric_type: string
                    sample_size: number
                    stddev_value: number | null
                }
                Insert: {
                    avg_value: number
                    category_id?: string | null
                    cohort_type: string
                    computed_at?: string | null
                    id?: string
                    metric_type: string
                    sample_size: number
                    stddev_value?: number | null
                }
                Update: {
                    avg_value?: number
                    category_id?: string | null
                    cohort_type?: string
                    computed_at?: string | null
                    id?: string
                    metric_type?: string
                    sample_size?: number
                    stddev_value?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cohort_averages_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                ]
            }
            collection_comments: {
                Row: {
                    category_id: string
                    content: string
                    created_at: string | null
                    id: string
                    is_creator_reply: boolean | null
                    parent_id: string | null
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    category_id: string
                    content: string
                    created_at?: string | null
                    id?: string
                    is_creator_reply?: boolean | null
                    parent_id?: string | null
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    category_id?: string
                    content?: string
                    created_at?: string | null
                    id?: string
                    is_creator_reply?: boolean | null
                    parent_id?: string | null
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "collection_comments_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "collection_comments_parent_id_fkey"
                        columns: ["parent_id"]
                        isOneToOne: false
                        referencedRelation: "collection_comments"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "collection_comments_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            collection_likes: {
                Row: {
                    category_id: string
                    created_at: string | null
                    user_id: string
                }
                Insert: {
                    category_id: string
                    created_at?: string | null
                    user_id: string
                }
                Update: {
                    category_id?: string
                    created_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "collection_likes_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "collection_likes_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            collection_saves: {
                Row: {
                    category_id: string
                    created_at: string | null
                    user_id: string
                }
                Insert: {
                    category_id: string
                    created_at?: string | null
                    user_id: string
                }
                Update: {
                    category_id?: string
                    created_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "collection_saves_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "collection_saves_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            collection_tags: {
                Row: {
                    added_by: string | null
                    category_id: string
                    created_at: string | null
                    id: string
                    is_admin_only: boolean | null
                    tag: string
                }
                Insert: {
                    added_by?: string | null
                    category_id: string
                    created_at?: string | null
                    id?: string
                    is_admin_only?: boolean | null
                    tag: string
                }
                Update: {
                    added_by?: string | null
                    category_id?: string
                    created_at?: string | null
                    id?: string
                    is_admin_only?: boolean | null
                    tag?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "collection_tags_added_by_fkey"
                        columns: ["added_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "collection_tags_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                ]
            }
            criteria_definitions: {
                Row: {
                    category_type: string
                    created_at: string | null
                    criterion_key: string
                    criterion_name: string
                    default_weight: number | null
                    description: string | null
                    display_order: number | null
                    id: string
                }
                Insert: {
                    category_type: string
                    created_at?: string | null
                    criterion_key: string
                    criterion_name: string
                    default_weight?: number | null
                    description?: string | null
                    display_order?: number | null
                    id?: string
                }
                Update: {
                    category_type?: string
                    created_at?: string | null
                    criterion_key?: string
                    criterion_name?: string
                    default_weight?: number | null
                    description?: string | null
                    display_order?: number | null
                    id?: string
                }
                Relationships: []
            }
            curator_notes: {
                Row: {
                    content: string
                    created_at: string | null
                    id: string
                    is_pinned: boolean | null
                    item_id: string
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    content: string
                    created_at?: string | null
                    id?: string
                    is_pinned?: boolean | null
                    item_id: string
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    content?: string
                    created_at?: string | null
                    id?: string
                    is_pinned?: boolean | null
                    item_id?: string
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "curator_notes_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "items"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "curator_notes_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            custom_ranks: {
                Row: {
                    category_id: string
                    color: string | null
                    created_at: string | null
                    id: string
                    name: string
                    sentiment: Database["public"]["Enums"]["rank_sentiment"]
                    sort_order: number | null
                    type: Database["public"]["Enums"]["rank_type"] | null
                }
                Insert: {
                    category_id: string
                    color?: string | null
                    created_at?: string | null
                    id?: string
                    name: string
                    sentiment: Database["public"]["Enums"]["rank_sentiment"]
                    sort_order?: number | null
                    type?: Database["public"]["Enums"]["rank_type"] | null
                }
                Update: {
                    category_id?: string
                    color?: string | null
                    created_at?: string | null
                    id?: string
                    name?: string
                    sentiment?: Database["public"]["Enums"]["rank_sentiment"]
                    sort_order?: number | null
                    type?: Database["public"]["Enums"]["rank_type"] | null
                }
                Relationships: [
                    {
                        foreignKeyName: "custom_ranks_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                ]
            }
            email_templates: {
                Row: {
                    body_html: string
                    id: string
                    last_updated: string | null
                    name: string
                    subject: string
                    variables: Json | null
                }
                Insert: {
                    body_html: string
                    id?: string
                    last_updated?: string | null
                    name: string
                    subject: string
                    variables?: Json | null
                }
                Update: {
                    body_html?: string
                    id?: string
                    last_updated?: string | null
                    name?: string
                    subject?: string
                    variables?: Json | null
                }
                Relationships: []
            }
            follows: {
                Row: {
                    created_at: string | null
                    follower_id: string
                    following_id: string
                }
                Insert: {
                    created_at?: string | null
                    follower_id: string
                    following_id: string
                }
                Update: {
                    created_at?: string | null
                    follower_id?: string
                    following_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "follows_follower_id_fkey"
                        columns: ["follower_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "follows_following_id_fkey"
                        columns: ["following_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            global_items: {
                Row: {
                    album_name: string | null
                    album_type: string | null
                    anilist_score: number | null
                    artist_names: string[] | null
                    artists: string[] | null
                    audio_features: Json | null
                    awards_text: string | null
                    backdrop_path: string | null
                    banner_url: string | null
                    best_players: string | null
                    bgg_id: number | null
                    box_office: string | null
                    budget: number | null
                    cached_tags: Json | null
                    cast: string[] | null
                    categories: string[] | null
                    category_type: string | null
                    chapters: number | null
                    complexity: number | null
                    content_rating: string | null
                    created_at: string | null
                    description: string | null
                    description_length: number | null
                    description_parts: Json | null
                    designers: string[] | null
                    developers: string[] | null
                    director: string | null
                    dlc_count: number | null
                    duration_ms: number | null
                    embedding: string | null
                    episodes: number | null
                    external_id: string | null
                    external_ids: Json | null
                    families: string[] | null
                    followers: number | null
                    format: string | null
                    franchise: string | null
                    game_engines: Json | null
                    game_modes: string[] | null
                    genres: string[] | null
                    homepage: string | null
                    id: string
                    image_url: string | null
                    imdb_rating: number | null
                    imdb_votes: number | null
                    is_expansion: boolean | null
                    isrc: string | null
                    keywords: string[] | null
                    label: string | null
                    language_dependence: string | null
                    last_metadata_update: string | null
                    logo_path: string | null
                    max_players: number | null
                    max_playtime: number | null
                    mechanics: string[] | null
                    metacritic: number | null
                    metacritic_rating: number | null
                    metadata: Json | null
                    min_age: number | null
                    min_age_community: number | null
                    min_players: number | null
                    min_playtime: number | null
                    networks: string[] | null
                    number_of_episodes: number | null
                    number_of_seasons: number | null
                    origin_countries: string[] | null
                    original_creator: string | null
                    original_language: string | null
                    original_title: string | null
                    perspectives: string[] | null
                    platforms: string[] | null
                    playtime: number | null
                    popularity: number | null
                    preview_url: string | null
                    production_companies: string[] | null
                    publishers: string[] | null
                    rank_overall: number | null
                    release_date: string | null
                    release_year: number | null
                    revenue: number | null
                    romaji_title: string | null
                    rotten_tomatoes_rating: number | null
                    runtime: number | null
                    screenshots: string[] | null
                    season: string | null
                    source: string | null
                    source_material: string | null
                    spoken_languages: string[] | null
                    staff: Json | null
                    status: string | null
                    studio: string | null
                    studios: string[] | null
                    tagline: string | null
                    themes: string[] | null
                    time_to_beat: Json | null
                    title: string
                    total_tracks: number | null
                    track_number: number | null
                    trailer_url: string | null
                    upc: string | null
                    vector_text: string | null
                    videos: string[] | null
                    volumes: number | null
                    vote_average: number | null
                    vote_count: number | null
                    watch_providers: Json | null
                    websites: Json | null
                    writer: string | null
                }
                Insert: {
                    album_name?: string | null
                    album_type?: string | null
                    anilist_score?: number | null
                    artist_names?: string[] | null
                    artists?: string[] | null
                    audio_features?: Json | null
                    awards_text?: string | null
                    backdrop_path?: string | null
                    banner_url?: string | null
                    best_players?: string | null
                    bgg_id?: number | null
                    box_office?: string | null
                    budget?: number | null
                    cached_tags?: Json | null
                    cast?: string[] | null
                    categories?: string[] | null
                    category_type?: string | null
                    chapters?: number | null
                    complexity?: number | null
                    content_rating?: string | null
                    created_at?: string | null
                    description?: string | null
                    description_length?: number | null
                    description_parts?: Json | null
                    designers?: string[] | null
                    developers?: string[] | null
                    director?: string | null
                    dlc_count?: number | null
                    duration_ms?: number | null
                    embedding?: string | null
                    episodes?: number | null
                    external_id?: string | null
                    external_ids?: Json | null
                    families?: string[] | null
                    followers?: number | null
                    format?: string | null
                    franchise?: string | null
                    game_engines?: Json | null
                    game_modes?: string[] | null
                    genres?: string[] | null
                    homepage?: string | null
                    id?: string
                    image_url?: string | null
                    imdb_rating?: number | null
                    imdb_votes?: number | null
                    is_expansion?: boolean | null
                    isrc?: string | null
                    keywords?: string[] | null
                    label?: string | null
                    language_dependence?: string | null
                    last_metadata_update?: string | null
                    logo_path?: string | null
                    max_players?: number | null
                    max_playtime?: number | null
                    mechanics?: string[] | null
                    metacritic?: number | null
                    metacritic_rating?: number | null
                    metadata?: Json | null
                    min_age?: number | null
                    min_age_community?: number | null
                    min_players?: number | null
                    min_playtime?: number | null
                    networks?: string[] | null
                    number_of_episodes?: number | null
                    number_of_seasons?: number | null
                    origin_countries?: string[] | null
                    original_creator?: string | null
                    original_language?: string | null
                    original_title?: string | null
                    perspectives?: string[] | null
                    platforms?: string[] | null
                    playtime?: number | null
                    popularity?: number | null
                    preview_url?: string | null
                    production_companies?: string[] | null
                    publishers?: string[] | null
                    rank_overall?: number | null
                    release_date?: string | null
                    release_year?: number | null
                    revenue?: number | null
                    romaji_title?: string | null
                    rotten_tomatoes_rating?: number | null
                    runtime?: number | null
                    screenshots?: string[] | null
                    season?: string | null
                    source?: string | null
                    source_material?: string | null
                    spoken_languages?: string[] | null
                    staff?: Json | null
                    status?: string | null
                    studio?: string | null
                    studios?: string[] | null
                    tagline?: string | null
                    themes?: string[] | null
                    time_to_beat?: Json | null
                    title: string
                    total_tracks?: number | null
                    track_number?: number | null
                    trailer_url?: string | null
                    upc?: string | null
                    vector_text?: string | null
                    videos?: string[] | null
                    volumes?: number | null
                    vote_average?: number | null
                    vote_count?: number | null
                    watch_providers?: Json | null
                    websites?: Json | null
                    writer?: string | null
                }
                Update: {
                    album_name?: string | null
                    album_type?: string | null
                    anilist_score?: number | null
                    artist_names?: string[] | null
                    artists?: string[] | null
                    audio_features?: Json | null
                    awards_text?: string | null
                    backdrop_path?: string | null
                    banner_url?: string | null
                    best_players?: string | null
                    bgg_id?: number | null
                    box_office?: string | null
                    budget?: number | null
                    cached_tags?: Json | null
                    cast?: string[] | null
                    categories?: string[] | null
                    category_type?: string | null
                    chapters?: number | null
                    complexity?: number | null
                    content_rating?: string | null
                    created_at?: string | null
                    description?: string | null
                    description_length?: number | null
                    description_parts?: Json | null
                    designers?: string[] | null
                    developers?: string[] | null
                    director?: string | null
                    dlc_count?: number | null
                    duration_ms?: number | null
                    embedding?: string | null
                    episodes?: number | null
                    external_id?: string | null
                    external_ids?: Json | null
                    families?: string[] | null
                    followers?: number | null
                    format?: string | null
                    franchise?: string | null
                    game_engines?: Json | null
                    game_modes?: string[] | null
                    genres?: string[] | null
                    homepage?: string | null
                    id?: string
                    image_url?: string | null
                    imdb_rating?: number | null
                    imdb_votes?: number | null
                    is_expansion?: boolean | null
                    isrc?: string | null
                    keywords?: string[] | null
                    label?: string | null
                    language_dependence?: string | null
                    last_metadata_update?: string | null
                    logo_path?: string | null
                    max_players?: number | null
                    max_playtime?: number | null
                    mechanics?: string[] | null
                    metacritic?: number | null
                    metacritic_rating?: number | null
                    metadata?: Json | null
                    min_age?: number | null
                    min_age_community?: number | null
                    min_players?: number | null
                    min_playtime?: number | null
                    networks?: string[] | null
                    number_of_episodes?: number | null
                    number_of_seasons?: number | null
                    origin_countries?: string[] | null
                    original_creator?: string | null
                    original_language?: string | null
                    original_title?: string | null
                    perspectives?: string[] | null
                    platforms?: string[] | null
                    playtime?: number | null
                    popularity?: number | null
                    preview_url?: string | null
                    production_companies?: string[] | null
                    publishers?: string[] | null
                    rank_overall?: number | null
                    release_date?: string | null
                    release_year?: number | null
                    revenue?: number | null
                    romaji_title?: string | null
                    rotten_tomatoes_rating?: number | null
                    runtime?: number | null
                    screenshots?: string[] | null
                    season?: string | null
                    source?: string | null
                    source_material?: string | null
                    spoken_languages?: string[] | null
                    staff?: Json | null
                    status?: string | null
                    studio?: string | null
                    studios?: string[] | null
                    tagline?: string | null
                    themes?: string[] | null
                    time_to_beat?: Json | null
                    title?: string
                    total_tracks?: number | null
                    track_number?: number | null
                    trailer_url?: string | null
                    upc?: string | null
                    vector_text?: string | null
                    videos?: string[] | null
                    volumes?: number | null
                    vote_average?: number | null
                    vote_count?: number | null
                    watch_providers?: Json | null
                    websites?: Json | null
                    writer?: string | null
                }
                Relationships: []
            }
            insight_unlocks: {
                Row: {
                    id: string
                    insight_key: string
                    unlock_context: Json | null
                    unlocked_at: string | null
                    user_id: string
                }
                Insert: {
                    id?: string
                    insight_key: string
                    unlock_context?: Json | null
                    unlocked_at?: string | null
                    user_id: string
                }
                Update: {
                    id?: string
                    insight_key?: string
                    unlock_context?: Json | null
                    unlocked_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "insight_unlocks_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            invites: {
                Row: {
                    code: string
                    created_at: string | null
                    created_by: string
                    id: string
                    is_used: boolean | null
                    max_uses: number | null
                    use_count: number | null
                    used_at: string | null
                    used_by: string | null
                }
                Insert: {
                    code: string
                    created_at?: string | null
                    created_by: string
                    id?: string
                    is_used?: boolean | null
                    max_uses?: number | null
                    use_count?: number | null
                    used_at?: string | null
                    used_by?: string | null
                }
                Update: {
                    code?: string
                    created_at?: string | null
                    created_by?: string
                    id?: string
                    is_used?: boolean | null
                    max_uses?: number | null
                    use_count?: number | null
                    used_at?: string | null
                    used_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "invites_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
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
                    category_id: string | null
                    created_at: string | null
                    description: string | null
                    elo_score: number | null
                    global_item_id: string | null
                    id: string
                    image: string | null
                    metadata: Json | null
                    name: string | null
                    notes: string | null
                    rank: number | null
                    status: Database["public"]["Enums"]["item_status"] | null
                    tier: string | null
                    updated_at: string | null
                    user_id: string | null
                }
                Insert: {
                    category_id?: string | null
                    created_at?: string | null
                    description?: string | null
                    elo_score?: number | null
                    global_item_id?: string | null
                    id?: string
                    image?: string | null
                    metadata?: Json | null
                    name?: string | null
                    notes?: string | null
                    rank?: number | null
                    status?: Database["public"]["Enums"]["item_status"] | null
                    tier?: string | null
                    updated_at?: string | null
                    user_id?: string | null
                }
                Update: {
                    category_id?: string | null
                    created_at?: string | null
                    description?: string | null
                    elo_score?: number | null
                    global_item_id?: string | null
                    id?: string
                    image?: string | null
                    metadata?: Json | null
                    name?: string | null
                    notes?: string | null
                    rank?: number | null
                    status?: Database["public"]["Enums"]["item_status"] | null
                    tier?: string | null
                    updated_at?: string | null
                    user_id?: string | null
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
            items_to_tags: {
                Row: {
                    item_id: string
                    tag_id: string
                }
                Insert: {
                    item_id: string
                    tag_id: string
                }
                Update: {
                    item_id?: string
                    tag_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "items_to_tags_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "items"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "items_to_tags_tag_id_fkey"
                        columns: ["tag_id"]
                        isOneToOne: false
                        referencedRelation: "tags"
                        referencedColumns: ["id"]
                    },
                ]
            }
            notifications: {
                Row: {
                    created_at: string | null
                    id: string
                    is_read: boolean | null
                    metadata: Json | null
                    recipient_id: string
                    reference_id: string | null
                    reference_type: string | null
                    type: Database["public"]["Enums"]["notification_type"]
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    is_read?: boolean | null
                    metadata?: Json | null
                    recipient_id: string
                    reference_id?: string | null
                    reference_type?: string | null
                    type: Database["public"]["Enums"]["notification_type"]
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    is_read?: boolean | null
                    metadata?: Json | null
                    recipient_id?: string
                    reference_id?: string | null
                    reference_type?: string | null
                    type?: Database["public"]["Enums"]["notification_type"]
                }
                Relationships: [
                    {
                        foreignKeyName: "notifications_recipient_id_fkey"
                        columns: ["recipient_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    bio: string | null
                    cover_image: string | null
                    created_at: string | null
                    display_name: string | null
                    email: string
                    email_verified: boolean | null
                    id: string
                    image: string | null
                    is_locked_out: boolean | null
                    is_public: boolean | null
                    name: string | null
                    preferences: Json | null
                    profile_views: number | null
                    role: Database["public"]["Enums"]["user_role"] | null
                    updated_at: string | null
                }
                Insert: {
                    bio?: string | null
                    cover_image?: string | null
                    created_at?: string | null
                    display_name?: string | null
                    email: string
                    email_verified?: boolean | null
                    id: string
                    image?: string | null
                    is_locked_out?: boolean | null
                    is_public?: boolean | null
                    name?: string | null
                    preferences?: Json | null
                    profile_views?: number | null
                    role?: Database["public"]["Enums"]["user_role"] | null
                    updated_at?: string | null
                }
                Update: {
                    bio?: string | null
                    cover_image?: string | null
                    created_at?: string | null
                    display_name?: string | null
                    email?: string
                    email_verified?: boolean | null
                    id?: string
                    image?: string | null
                    is_locked_out?: boolean | null
                    is_public?: boolean | null
                    name?: string | null
                    preferences?: Json | null
                    profile_views?: number | null
                    role?: Database["public"]["Enums"]["user_role"] | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            ratings: {
                Row: {
                    created_at: string | null
                    custom_rank: string | null
                    id: string
                    item_id: string
                    tier: string | null
                    type: Database["public"]["Enums"]["rating_type"]
                    user_id: string
                    value: number
                }
                Insert: {
                    created_at?: string | null
                    custom_rank?: string | null
                    id?: string
                    item_id: string
                    tier?: string | null
                    type: Database["public"]["Enums"]["rating_type"]
                    user_id: string
                    value: number
                }
                Update: {
                    created_at?: string | null
                    custom_rank?: string | null
                    id?: string
                    item_id?: string
                    tier?: string | null
                    type?: Database["public"]["Enums"]["rating_type"]
                    user_id?: string
                    value?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "ratings_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "items"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "ratings_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            reports: {
                Row: {
                    created_at: string | null
                    details: string | null
                    global_item_id: string
                    id: string
                    reason: Database["public"]["Enums"]["report_reason"]
                    reporter_id: string | null
                    resolution_notes: string | null
                    resolved_at: string | null
                    resolved_by: string | null
                    status: Database["public"]["Enums"]["report_status"] | null
                }
                Insert: {
                    created_at?: string | null
                    details?: string | null
                    global_item_id: string
                    id?: string
                    reason: Database["public"]["Enums"]["report_reason"]
                    reporter_id?: string | null
                    resolution_notes?: string | null
                    resolved_at?: string | null
                    resolved_by?: string | null
                    status?: Database["public"]["Enums"]["report_status"] | null
                }
                Update: {
                    created_at?: string | null
                    details?: string | null
                    global_item_id?: string
                    id?: string
                    reason?: Database["public"]["Enums"]["report_reason"]
                    reporter_id?: string | null
                    resolution_notes?: string | null
                    resolved_at?: string | null
                    resolved_by?: string | null
                    status?: Database["public"]["Enums"]["report_status"] | null
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
                        foreignKeyName: "reports_reporter_id_fkey"
                        columns: ["reporter_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "reports_resolved_by_fkey"
                        columns: ["resolved_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            share_cards: {
                Row: {
                    category_id: string
                    created_at: string | null
                    id: string
                    image_url: string | null
                    metadata: Json | null
                    share_hash: string
                    template: string | null
                    user_id: string
                    view_count: number | null
                }
                Insert: {
                    category_id: string
                    created_at?: string | null
                    id?: string
                    image_url?: string | null
                    metadata?: Json | null
                    share_hash: string
                    template?: string | null
                    user_id: string
                    view_count?: number | null
                }
                Update: {
                    category_id?: string
                    created_at?: string | null
                    id?: string
                    image_url?: string | null
                    metadata?: Json | null
                    share_hash?: string
                    template?: string | null
                    user_id?: string
                    view_count?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "share_cards_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "share_cards_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            system_config: {
                Row: {
                    description: string | null
                    is_secret: boolean | null
                    key: string
                    updated_at: string | null
                    value: string
                }
                Insert: {
                    description?: string | null
                    is_secret?: boolean | null
                    key: string
                    updated_at?: string | null
                    value: string
                }
                Update: {
                    description?: string | null
                    is_secret?: boolean | null
                    key?: string
                    updated_at?: string | null
                    value?: string
                }
                Relationships: []
            }
            system_settings: {
                Row: {
                    category: string
                    is_secret: boolean | null
                    key: string
                    updated_at: string | null
                    value: string
                }
                Insert: {
                    category: string
                    is_secret?: boolean | null
                    key: string
                    updated_at?: string | null
                    value: string
                }
                Update: {
                    category?: string
                    is_secret?: boolean | null
                    key?: string
                    updated_at?: string | null
                    value?: string
                }
                Relationships: []
            }
            tags: {
                Row: {
                    id: string
                    name: string
                }
                Insert: {
                    id?: string
                    name: string
                }
                Update: {
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            taste_metrics: {
                Row: {
                    category_id: string | null
                    computed_at: string | null
                    id: string
                    metric_type: string
                    user_id: string
                    value: number
                }
                Insert: {
                    category_id?: string | null
                    computed_at?: string | null
                    id?: string
                    metric_type: string
                    user_id: string
                    value: number
                }
                Update: {
                    category_id?: string | null
                    computed_at?: string | null
                    id?: string
                    metric_type?: string
                    user_id?: string
                    value?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "taste_metrics_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "taste_metrics_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            taste_snapshots: {
                Row: {
                    captured_at: string | null
                    category_id: string | null
                    id: string
                    item_count: number
                    metrics_json: Json
                    snapshot_type: string
                    top_genres_json: Json | null
                    user_id: string
                }
                Insert: {
                    captured_at?: string | null
                    category_id?: string | null
                    id?: string
                    item_count: number
                    metrics_json: Json
                    snapshot_type: string
                    top_genres_json?: Json | null
                    user_id: string
                }
                Update: {
                    captured_at?: string | null
                    category_id?: string | null
                    id?: string
                    item_count?: number
                    metrics_json?: Json
                    snapshot_type?: string
                    top_genres_json?: Json | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "taste_snapshots_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "taste_snapshots_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            unlock_conditions: {
                Row: {
                    category_scoped: boolean | null
                    condition_type: string
                    display_label: string
                    id: string
                    insight_key: string
                    threshold: number
                }
                Insert: {
                    category_scoped?: boolean | null
                    condition_type: string
                    display_label: string
                    id?: string
                    insight_key: string
                    threshold: number
                }
                Update: {
                    category_scoped?: boolean | null
                    condition_type?: string
                    display_label?: string
                    id?: string
                    insight_key?: string
                    threshold?: number
                }
                Relationships: []
            }
            user_challenges: {
                Row: {
                    category_id: string
                    completed_at: string | null
                    joined_at: string | null
                    progress: number | null
                    status: string | null
                    user_id: string
                }
                Insert: {
                    category_id: string
                    completed_at?: string | null
                    joined_at?: string | null
                    progress?: number | null
                    status?: string | null
                    user_id: string
                }
                Update: {
                    category_id?: string
                    completed_at?: string | null
                    joined_at?: string | null
                    progress?: number | null
                    status?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_challenges_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "user_challenges_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            user_criteria_ratings: {
                Row: {
                    created_at: string | null
                    criterion_key: string
                    id: string
                    item_id: string
                    rating: number
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    created_at?: string | null
                    criterion_key: string
                    id?: string
                    item_id: string
                    rating: number
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    created_at?: string | null
                    criterion_key?: string
                    id?: string
                    item_id?: string
                    rating?: number
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_criteria_ratings_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "items"
                        referencedColumns: ["id"]
                    },
                ]
            }
            user_criteria_weights: {
                Row: {
                    category_type: string
                    created_at: string | null
                    criterion_key: string
                    id: string
                    updated_at: string | null
                    user_id: string
                    weight: number
                }
                Insert: {
                    category_type: string
                    created_at?: string | null
                    criterion_key: string
                    id?: string
                    updated_at?: string | null
                    user_id: string
                    weight: number
                }
                Update: {
                    category_type?: string
                    created_at?: string | null
                    criterion_key?: string
                    id?: string
                    updated_at?: string | null
                    user_id?: string
                    weight?: number
                }
                Relationships: []
            }
            user_top_picks: {
                Row: {
                    id: string
                    item_id: string
                    pinned_at: string | null
                    sort_order: number | null
                    user_id: string
                }
                Insert: {
                    id?: string
                    item_id: string
                    pinned_at?: string | null
                    sort_order?: number | null
                    user_id: string
                }
                Update: {
                    id?: string
                    item_id?: string
                    pinned_at?: string | null
                    sort_order?: number | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_top_picks_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "items"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "user_top_picks_user_id_fkey"
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
            browse_items: {
                Args: {
                    p_category_types?: string[]
                    p_page?: number
                    p_page_size?: number
                    p_search?: string
                    p_sort_field?: string
                    p_sort_order?: string
                }
                Returns: {
                    backdrop_path: string
                    cached_tags: Json
                    category_type: string
                    description: string
                    director: string
                    genres: string[]
                    id: string
                    image_url: string
                    release_year: number
                    studio: string
                    title: string
                    total_count: number
                    vote_average: number
                }[]
            }
            description_length: {
                Args: { item: Database["public"]["Tables"]["global_items"]["Row"] }
                Returns: number
            }
            find_similar_items: {
                Args: {
                    category_filter?: string
                    match_count?: number
                    source_item_id: string
                }
                Returns: {
                    category_type: string
                    id: string
                    image_url: string
                    similarity: number
                    title: string
                }[]
            }
            get_borda_rankings: {
                Args: {
                    p_category_type?: string
                    p_limit?: number
                    p_min_voters?: number
                }
                Returns: {
                    borda_score: number
                    global_item_id: string
                    image_url: string
                    tier_distribution: Json
                    title: string
                    voter_count: number
                }[]
            }
            get_category_stats: {
                Args: Record<PropertyKey, never>
                Returns: {
                    category: string
                    count: number
                }[]
            }
            get_filter_values: {
                Args: {
                    p_category?: string
                    p_column: string
                    p_limit?: number
                    p_search?: string
                }
                Returns: {
                    count: number
                    value: string
                }[]
            }
            get_profile_count: { Args: Record<PropertyKey, never>; Returns: number }
            get_short_description_items: {
                Args: {
                    p_category_types?: string[]
                    p_limit?: number
                    p_offset?: number
                }
                Returns: {
                    id: string
                }[]
            }
            get_taste_compatibility: {
                Args: { user_a_id: string; user_b_id: string }
                Returns: number
            }
            get_user_stats_analytics: {
                Args: { p_category_id?: string; p_user_id: string }
                Returns: Json
            }
            match_documents: {
                Args: {
                    category_filter?: string
                    match_count?: number
                    match_threshold?: number
                    query_embedding: string
                }
                Returns: {
                    category_type: string
                    description: string
                    id: string
                    image_url: string
                    similarity: number
                    title: string
                }[]
            }
            search_items: {
                Args: {
                    category_filter?: string
                    match_count?: number
                    match_threshold?: number
                    query_embedding: string
                }
                Returns: {
                    category_type: string
                    description: string
                    id: string
                    image_url: string
                    similarity: number
                    title: string
                }[]
            }
            search_items_by_vector: {
                Args: {
                    match_count?: number
                    match_threshold?: number
                    query_embedding: string
                }
                Returns: {
                    id: string
                    posterUrl: string
                    similarity: number
                    title: string
                }[]
            }
            show_limit: { Args: Record<PropertyKey, never>; Returns: number }
            show_trgm: { Args: { "": string }; Returns: string[] }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
    graphql_public: {
        Enums: {},
    },
    public: {
        Enums: {
            item_status: ["ACTIVE", "IGNORED", "WISHLIST", "SEEN"],
            notification_type: [
                "admin_report_alert",
                "user_follow",
                "item_update",
                "report_resolved",
            ],
            rank_sentiment: ["POSITIVE", "NEUTRAL", "NEGATIVE"],
            rank_type: ["RANKED", "UTILITY"],
            rating_type: ["NUMERICAL", "TIER", "HYBRID"],
            report_reason: ["inaccurate_data", "duplicate", "inappropriate", "other"],
            report_status: ["pending", "resolved", "dismissed"],
            user_role: ["USER", "ADMIN", "MODERATOR"],
        },
    },
} as const

// =============================================================================
// CONVENIENCE TYPE ALIASES
// =============================================================================

/** Profile row type - convenience alias for use in components */
export type Profile = Tables<'profiles'>

/** Global Item row type */
export type GlobalItem = Tables<'global_items'>

/** Item row type */
export type Item = Tables<'items'>

/** Category row type */
export type Category = Tables<'categories'>
