import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description'
import { generateEmbedding } from '@/lib/harvesters/shared'

const OMDB_API_KEY = process.env.OMDB_API_KEY
const OMDB_BASE_URL = 'https://www.omdbapi.com'

/**
 * Category-specific provider mapping
 */
const PROVIDER_MAP: Record<string, { name: string; searchFn: string }> = {
    MOVIE: { name: 'TMDB + OMDB', searchFn: 'searchTMDB' },
    TV: { name: 'TMDB + OMDB', searchFn: 'searchTMDB' },
    TV_SHOW: { name: 'TMDB + OMDB', searchFn: 'searchTMDB' },
    ANIME: { name: 'AniList', searchFn: 'searchAniList' },
    VIDEO_GAME: { name: 'IGDB', searchFn: 'searchIGDB' },
    BOARD_GAME: { name: 'BGG', searchFn: 'searchBGG' },
    MUSIC_ALBUM: { name: 'Spotify', searchFn: 'searchSpotify' },
    MUSIC_TRACK: { name: 'Spotify', searchFn: 'searchSpotify' },
    MUSIC_ARTIST: { name: 'Spotify', searchFn: 'searchSpotify' },
    BOOK: { name: 'Google Books', searchFn: 'searchGoogleBooks' },
    PODCAST: { name: 'Podcast Index', searchFn: 'searchPodcasts' },
}

/**
 * Fetch OMDB data by IMDB ID
 */
async function fetchOmdbData(imdbId: string) {
    if (!OMDB_API_KEY || !imdbId) return null

    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&i=${imdbId}&tomatoes=true`
    try {
        const res = await fetch(url)
        if (!res.ok) return null

        const data = await res.json()
        if (data.Response === 'False') return null

        // Extract Rotten Tomatoes safely
        let rtScore: number | null = null
        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes')
        if (rtSource && rtSource.Value) {
            rtScore = parseInt(rtSource.Value.replace('%', ''), 10)
        }

        return {
            imdb_rating: data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
            imdb_votes: data.imdbVotes ? parseInt(data.imdbVotes.replace(/,/g, ''), 10) : null,
            rotten_tomatoes_rating: rtScore,
            metacritic_rating: data.Metascore && data.Metascore !== 'N/A' ? parseInt(data.Metascore, 10) : null,
            awards: data.Awards && data.Awards !== 'N/A' ? data.Awards : null,
            rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : null,
            writer: data.Writer && data.Writer !== 'N/A' ? data.Writer : null,
            box_office: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
        }
    } catch (e) {
        return null
    }
}

/**
 * Fetch OMDB data by title and year (fallback)
 */
async function fetchOmdbDataByTitle(title: string, year: number) {
    if (!OMDB_API_KEY) return null
    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}&tomatoes=true`
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const data = await res.json()
        if (data.Response === 'False') return null

        let rtScore: number | null = null
        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes')
        if (rtSource && rtSource.Value) {
            rtScore = parseInt(rtSource.Value.replace('%', ''), 10)
        }

        return {
            imdb_rating: data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
            imdb_votes: data.imdbVotes ? parseInt(data.imdbVotes.replace(/,/g, ''), 10) : null,
            rotten_tomatoes_rating: rtScore,
            metacritic_rating: data.Metascore && data.Metascore !== 'N/A' ? parseInt(data.Metascore, 10) : null,
            awards: data.Awards && data.Awards !== 'N/A' ? data.Awards : null,
            rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : null,
            writer: data.Writer && data.Writer !== 'N/A' ? data.Writer : null,
            box_office: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
        }
    } catch (e) {
        return null
    }
}

/**
 * API endpoint to enrich item metadata from category-specific providers
 * Also regenerates description and embedding
 */
export async function POST(request: NextRequest) {
    try {
        const { itemId, title, type } = await request.json()

        if (!itemId || !title || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: itemId, title, type' },
                { status: 400 }
            )
        }

        const supabase = await createClient()
        const serviceSupabase = createServiceRoleClient()

        // Get current item
        const { data: existingItem, error: fetchError } = await (supabase.from('global_items') as any)
            .select('*')
            .eq('id', itemId)
            .single()

        if (fetchError || !existingItem) {
            return NextResponse.json(
                { error: 'Item not found' },
                { status: 404 }
            )
        }

        const provider = PROVIDER_MAP[type] || { name: 'Unknown', searchFn: null }
        let enrichedData: Record<string, any> = {}
        let providerResult: any = null

        // Import and call the appropriate search function based on category
        try {
            const { searchMediaAction } = await import('@/lib/actions/media')
            const searchResult = await searchMediaAction(title, type, null, undefined)

            if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
                // Find best match (usually first result)
                providerResult = searchResult.data[0]

                // Map provider-specific fields to our schema
                enrichedData = mapProviderData(type, providerResult, existingItem)
            }
        } catch (searchError) {
            console.warn(`Provider search failed for ${type}:`, searchError)
            // Continue with description regeneration even if provider search fails
        }

        // For Movies and TV: Also fetch OMDB data for ratings
        let omdbStatus: 'success' | 'not_found' | 'skipped' | 'error' = 'skipped'
        let omdbRatingsFound: string[] = []

        if (['MOVIE', 'TV', 'TV_SHOW'].includes(type)) {
            let omdbData = null
            const imdbId = existingItem.external_ids?.imdb || providerResult?.imdb_id

            console.log(`[OMDB] Fetching ratings for "${title}" (${type})`)

            try {
                if (imdbId) {
                    console.log(`[OMDB] Trying IMDB ID: ${imdbId}`)
                    omdbData = await fetchOmdbData(imdbId)
                }

                if (!omdbData) {
                    console.log(`[OMDB] Trying title search: "${title}" (${existingItem.release_year})`)
                    omdbData = await fetchOmdbDataByTitle(title, existingItem.release_year)
                }

                if (omdbData) {
                    omdbStatus = 'success'
                    console.log(`[OMDB] ✅ Data found:`)

                    // Map OMDB data (only update if missing)
                    if (omdbData.imdb_rating && !existingItem.imdb_rating) {
                        enrichedData.imdb_rating = omdbData.imdb_rating
                        omdbRatingsFound.push(`IMDB: ${omdbData.imdb_rating}`)
                    }
                    if (omdbData.imdb_votes && !existingItem.imdb_votes) {
                        enrichedData.imdb_votes = omdbData.imdb_votes
                    }
                    if (omdbData.rotten_tomatoes_rating && !existingItem.rotten_tomatoes_rating) {
                        enrichedData.rotten_tomatoes_rating = omdbData.rotten_tomatoes_rating
                        omdbRatingsFound.push(`RT: ${omdbData.rotten_tomatoes_rating}%`)
                    }
                    if (omdbData.metacritic_rating && !existingItem.metacritic_rating) {
                        enrichedData.metacritic_rating = omdbData.metacritic_rating
                        omdbRatingsFound.push(`MC: ${omdbData.metacritic_rating}`)
                    }
                    if (omdbData.awards && !existingItem.awards_text) {
                        enrichedData.awards_text = omdbData.awards
                        omdbRatingsFound.push('Awards')
                    }
                    if (omdbData.rated && !existingItem.content_rating) {
                        enrichedData.content_rating = omdbData.rated
                    }
                    if (omdbData.writer && !existingItem.writer) {
                        enrichedData.writer = omdbData.writer
                    }
                    if (omdbData.box_office && !existingItem.box_office) {
                        enrichedData.box_office = omdbData.box_office
                    }

                    console.log(`[OMDB]    Ratings: ${omdbRatingsFound.length > 0 ? omdbRatingsFound.join(' | ') : 'None new (already populated)'}`)
                } else {
                    omdbStatus = 'not_found'
                    console.log(`[OMDB] ⚠️ No data found for "${title}"`)
                }
            } catch (omdbError: any) {
                omdbStatus = 'error'
                console.error(`[OMDB] ❌ Error fetching data:`, omdbError.message)
            }
        }

        // Generate 4-part structured description with any new metadata
        const description_parts = await generateStructuredDescription(serviceSupabase, {
            title,
            originalDescription: existingItem.description || '',
            type,
            metadata: { ...existingItem.metadata, ...enrichedData.metadata }
        })

        const description = combineDescription(description_parts)

        // Build rich embedding text
        const embeddingText = buildEmbeddingText({
            ...existingItem,
            ...enrichedData,
            description,
            description_parts
        })

        // Generate new embedding
        const embedding = await generateEmbedding(embeddingText)

        // Prepare update payload
        const updateData: any = {
            description,
            description_parts,
            ...enrichedData
        }

        if (embedding) {
            updateData.embedding = embedding
        }

        // Update the item
        const { error: updateError } = await (supabase.from('global_items') as any)
            .update(updateData)
            .eq('id', itemId)

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            )
        }

        console.log(`[Enrich] ✅ Updated "${title}" with ${Object.keys(enrichedData).length} fields`)

        return NextResponse.json({
            success: true,
            provider: provider.name,
            enriched: Object.keys(enrichedData).length > 0,
            fieldsUpdated: Object.keys(enrichedData),
            enrichedData, // Include actual values so client can update local state
            omdbStatus,
            omdbRatings: omdbRatingsFound,
            description,
            description_parts
        })

    } catch (error: any) {
        console.error('Enrich metadata error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to enrich metadata' },
            { status: 500 }
        )
    }
}

/**
 * Map provider-specific data to our unified schema
 */
function mapProviderData(type: string, providerData: any, existingItem: any): Record<string, any> {
    const enriched: Record<string, any> = {}

    // Only update fields that are currently empty/null
    const updateIfMissing = (field: string, value: any) => {
        if (value !== undefined && value !== null && value !== '' &&
            (existingItem[field] === null || existingItem[field] === undefined || existingItem[field] === '')) {
            enriched[field] = value
        }
    }

    // Common fields
    updateIfMissing('image_url', providerData.imageUrl || providerData.poster_path)
    updateIfMissing('release_year', providerData.year || providerData.releaseYear)

    // Category-specific mappings
    switch (type) {
        case 'MOVIE':
        case 'TV':
        case 'TV_SHOW':
            updateIfMissing('backdrop_path', providerData.backdrop_path)
            updateIfMissing('vote_average', providerData.vote_average)
            updateIfMissing('genres', providerData.genres)
            updateIfMissing('runtime', providerData.runtime)
            updateIfMissing('director', providerData.director)
            updateIfMissing('tagline', providerData.tagline)
            break

        case 'ANIME':
            updateIfMissing('romaji_title', providerData.romaji_title)
            updateIfMissing('anilist_score', providerData.score)
            updateIfMissing('status', providerData.status)
            updateIfMissing('genres', providerData.genres)
            updateIfMissing('studios', providerData.studios)
            break

        case 'VIDEO_GAME':
            updateIfMissing('platforms', providerData.platforms)
            updateIfMissing('developers', providerData.developers)
            updateIfMissing('publishers', providerData.publishers)
            updateIfMissing('genres', providerData.genres)
            updateIfMissing('vote_average', providerData.rating)
            break

        case 'BOARD_GAME':
            updateIfMissing('designers', providerData.designers)
            updateIfMissing('publishers', providerData.publishers)
            updateIfMissing('min_players', providerData.minPlayers)
            updateIfMissing('max_players', providerData.maxPlayers)
            updateIfMissing('complexity', providerData.complexity)
            updateIfMissing('vote_average', providerData.rating)
            break

        case 'MUSIC_ALBUM':
        case 'MUSIC_TRACK':
        case 'MUSIC_ARTIST':
            updateIfMissing('artist_names', providerData.artists || providerData.artistNames)
            updateIfMissing('label', providerData.label)
            updateIfMissing('popularity', providerData.popularity)
            updateIfMissing('spotify_url', providerData.spotify_url || providerData.external_urls?.spotify)
            updateIfMissing('preview_url', providerData.preview_url)
            break

        case 'BOOK':
            updateIfMissing('author', providerData.authors?.[0])
            updateIfMissing('publisher', providerData.publisher)
            updateIfMissing('isbn', providerData.isbn)
            updateIfMissing('page_count', providerData.pageCount)
            break
    }

    // Store external ID in metadata
    if (providerData.id && !existingItem.external_ids?.[type.toLowerCase()]) {
        enriched.external_ids = {
            ...existingItem.external_ids,
            [type.toLowerCase()]: providerData.id
        }
    }

    return enriched
}

