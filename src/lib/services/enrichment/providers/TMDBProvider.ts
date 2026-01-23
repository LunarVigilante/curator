/**
 * TMDB + OMDB Provider
 * 
 * Handles metadata fetching for: MOVIE, TV_SHOW
 * 
 * Uses TMDB for core metadata and OMDB for ratings/awards.
 */

import { MetadataProvider, ProviderResult, ProviderItem, updateField } from './types'

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY
const OMDB_API_KEY = process.env.OMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const OMDB_BASE_URL = 'https://www.omdbapi.com'

// ============================================================================
// TMDB FETCHING
// ============================================================================

async function fetchTmdbDetails(tmdbId: number | string, type: string): Promise<any | null> {
    if (!TMDB_API_KEY) return null

    const endpoint = type === 'MOVIE' ? 'movie' : 'tv'
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,keywords,external_ids`

    try {
        const res = await fetch(url)
        if (!res.ok) return null
        return await res.json()
    } catch (e) {
        console.error('[TMDBProvider] Fetch error:', e)
        return null
    }
}

async function searchTmdb(title: string, type: string): Promise<any | null> {
    if (!TMDB_API_KEY) return null

    const endpoint = type === 'MOVIE' ? 'movie' : 'tv'
    const url = `${TMDB_BASE_URL}/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`

    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const data = await res.json()
        return data.results?.[0] || null
    } catch {
        return null
    }
}

// ============================================================================
// OMDB FETCHING (Ratings/Awards)
// ============================================================================

async function fetchOmdbData(imdbId: string): Promise<any | null> {
    if (!OMDB_API_KEY || !imdbId) return null

    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&i=${imdbId}&tomatoes=true`
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const data = await res.json()
        if (data.Response === 'False') return null

        let rtScore: number | null = null
        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes')
        if (rtSource?.Value) {
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
            plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : null,
            country: data.Country && data.Country !== 'N/A' ? data.Country : null,
        }
    } catch {
        return null
    }
}

async function fetchOmdbDataByTitle(title: string, year: number): Promise<any | null> {
    if (!OMDB_API_KEY) return null
    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}&tomatoes=true`
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const data = await res.json()
        if (data.Response === 'False') return null

        let rtScore: number | null = null
        const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes')
        if (rtSource?.Value) {
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
            plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : null,
            country: data.Country && data.Country !== 'N/A' ? data.Country : null,
        }
    } catch {
        return null
    }
}

// ============================================================================
// PROVIDER IMPLEMENTATION
// ============================================================================

export const TMDBProvider: MetadataProvider = {
    name: 'TMDB + OMDB',
    supportedCategories: ['MOVIE', 'TV_SHOW', 'TV'],

    async fetchMetadata(item: ProviderItem, force: boolean): Promise<ProviderResult> {
        const enriched: Record<string, any> = {}
        const fieldsUpdated: string[] = []

        try {
            // Step 1: Get TMDB ID (from external_ids or search)
            let tmdbId = item.external_ids?.tmdb
            let tmdbData: any = null

            if (tmdbId) {
                tmdbData = await fetchTmdbDetails(tmdbId, item.category_type)
            } else {
                // Search for it
                const searchResult = await searchTmdb(item.title, item.category_type)
                if (searchResult?.id) {
                    tmdbId = searchResult.id
                    tmdbData = await fetchTmdbDetails(tmdbId, item.category_type)
                }
            }

            if (tmdbData) {
                const mapped = this.mapToSchema(tmdbData, item, force)
                Object.assign(enriched, mapped)
                fieldsUpdated.push(...Object.keys(mapped))
            }

            // Step 2: Get OMDB data for ratings
            const imdbId = item.external_ids?.imdb || tmdbData?.external_ids?.imdb_id
            let omdbData = null

            if (imdbId) {
                omdbData = await fetchOmdbData(imdbId)
            }
            if (!omdbData && item.release_year) {
                omdbData = await fetchOmdbDataByTitle(item.title, item.release_year)
            }

            if (omdbData) {
                if (omdbData.imdb_rating && (force || !item.imdb_rating)) {
                    enriched.imdb_rating = omdbData.imdb_rating
                    fieldsUpdated.push('imdb_rating')
                }
                if (omdbData.imdb_votes && (force || !item.imdb_votes)) {
                    enriched.imdb_votes = omdbData.imdb_votes
                    fieldsUpdated.push('imdb_votes')
                }
                if (omdbData.rotten_tomatoes_rating && (force || !item.rotten_tomatoes_rating)) {
                    enriched.rotten_tomatoes_rating = omdbData.rotten_tomatoes_rating
                    fieldsUpdated.push('rotten_tomatoes_rating')
                }
                if (omdbData.metacritic_rating && (force || !item.metacritic_rating)) {
                    enriched.metacritic_rating = omdbData.metacritic_rating
                    fieldsUpdated.push('metacritic_rating')
                }
                if (omdbData.awards && (force || !item.awards_text)) {
                    enriched.awards_text = omdbData.awards
                    fieldsUpdated.push('awards_text')
                }
                if (omdbData.rated && (force || !item.content_rating)) {
                    enriched.content_rating = omdbData.rated
                    fieldsUpdated.push('content_rating')
                }
                if (omdbData.writer && (force || !item.writer)) {
                    enriched.writer = omdbData.writer
                    fieldsUpdated.push('writer')
                }
                if (omdbData.box_office && (force || !item.box_office)) {
                    enriched.box_office = omdbData.box_office
                    fieldsUpdated.push('box_office')
                }
                // Store OMDB plot and country in metadata for embeddings
                if (omdbData.plot || omdbData.country) {
                    const existingMetadata = enriched.metadata || item.metadata || {}
                    enriched.metadata = {
                        ...existingMetadata,
                        ...(omdbData.plot && { omdb_plot: omdbData.plot }),
                        ...(omdbData.country && { omdb_country: omdbData.country })
                    }
                    if (omdbData.plot) fieldsUpdated.push('omdb_plot')
                    if (omdbData.country) fieldsUpdated.push('omdb_country')
                }
            }

            return {
                success: true,
                data: enriched,
                fieldsUpdated: [...new Set(fieldsUpdated)],
                providerName: this.name
            }

        } catch (error: any) {
            return {
                success: false,
                data: {},
                fieldsUpdated: [],
                providerName: this.name,
                error: error.message
            }
        }
    },

    mapToSchema(rawData: any, existingItem: any, force: boolean): Record<string, any> {
        const enriched: Record<string, any> = {}
        const metadataUpdates: Record<string, any> = {}

        // =====================================================================
        // CORE FIELDS (stored in top-level columns)
        // =====================================================================

        // backdrop_path from TMDB needs to be prefixed with the image base URL
        if (rawData.backdrop_path) {
            const fullBackdropUrl = `https://image.tmdb.org/t/p/original${rawData.backdrop_path}`
            updateField(enriched, existingItem, 'backdrop_path', fullBackdropUrl, force)
        }

        updateField(enriched, existingItem, 'vote_average', rawData.vote_average, force)
        updateField(enriched, existingItem, 'genres', rawData.genres?.map((g: any) => g.name), force)
        updateField(enriched, existingItem, 'runtime', rawData.runtime || rawData.episode_run_time?.[0], force)
        updateField(enriched, existingItem, 'tagline', rawData.tagline, force)
        updateField(enriched, existingItem, 'status', rawData.status, force)
        updateField(enriched, existingItem, 'original_language', rawData.original_language, force)
        updateField(enriched, existingItem, 'original_title', rawData.original_title || rawData.original_name, force)
        updateField(enriched, existingItem, 'popularity', rawData.popularity, force)
        updateField(enriched, existingItem, 'vote_count', rawData.vote_count, force)
        updateField(enriched, existingItem, 'budget', rawData.budget, force)
        updateField(enriched, existingItem, 'revenue', rawData.revenue, force)

        // Release date (extract full date, not just year)
        if (rawData.release_date) {
            metadataUpdates.release_date = rawData.release_date
        }

        // Adult content flag
        if (rawData.adult !== undefined) {
            metadataUpdates.adult = rawData.adult
        }

        // =====================================================================
        // CREW (Director, Writers, Cinematographer, Composer, Producers, Editor)
        // =====================================================================
        const crew = rawData.credits?.crew || []

        const director = crew.find((c: any) => c.job === 'Director')?.name
        updateField(enriched, existingItem, 'director', director, force)

        // Cinematographer (Director of Photography)
        const cinematographer = crew.find((c: any) => c.job === 'Director of Photography' || c.job === 'Cinematography')?.name
        if (cinematographer) metadataUpdates.cinematographer = cinematographer

        // Composer
        const composer = crew.find((c: any) => c.job === 'Original Music Composer' || c.job === 'Music')?.name
        if (composer) metadataUpdates.composer = composer

        // Editor
        const editor = crew.find((c: any) => c.job === 'Editor')?.name
        if (editor) metadataUpdates.editor = editor

        // Producers (first 3)
        const producers = crew
            .filter((c: any) => c.job === 'Producer' || c.job === 'Executive Producer')
            .slice(0, 3)
            .map((c: any) => c.name)
        if (producers.length > 0) metadataUpdates.producers = producers

        // =====================================================================
        // CAST
        // =====================================================================
        if (rawData.credits?.cast) {
            updateField(enriched, existingItem, 'cast', rawData.credits.cast.slice(0, 20).map((c: any) => c.name), force)
            metadataUpdates.credits = { cast: rawData.credits.cast.slice(0, 20) }
        }

        // =====================================================================
        // PRODUCTION INFO
        // =====================================================================

        // Production companies
        if (rawData.production_companies?.length > 0) {
            const companies = rawData.production_companies.map((c: any) => c.name)
            updateField(enriched, existingItem, 'production_companies', companies, force)
        }

        // Production countries
        if (rawData.production_countries?.length > 0) {
            const countries = rawData.production_countries.map((c: any) => c.iso_3166_1)
            updateField(enriched, existingItem, 'origin_countries', countries, force)
            metadataUpdates.production_countries = rawData.production_countries.map((c: any) => c.name)
        }

        // Spoken languages
        if (rawData.spoken_languages?.length > 0) {
            metadataUpdates.spoken_languages = rawData.spoken_languages.map((l: any) => l.english_name || l.name)
        }

        // =====================================================================
        // KEYWORDS (for better embeddings)
        // =====================================================================
        if (rawData.keywords?.keywords?.length > 0) {
            // Movie keywords are in keywords.keywords
            updateField(enriched, existingItem, 'keywords', rawData.keywords.keywords.map((k: any) => k.name), force)
        } else if (rawData.keywords?.results?.length > 0) {
            // TV keywords are in keywords.results
            updateField(enriched, existingItem, 'keywords', rawData.keywords.results.map((k: any) => k.name), force)
        }

        // =====================================================================
        // COLLECTION (Franchise info)
        // =====================================================================
        if (rawData.belongs_to_collection) {
            metadataUpdates.belongs_to_collection = {
                id: rawData.belongs_to_collection.id,
                name: rawData.belongs_to_collection.name,
                poster_path: rawData.belongs_to_collection.poster_path,
                backdrop_path: rawData.belongs_to_collection.backdrop_path
            }
        }

        // =====================================================================
        // TV-SPECIFIC
        // =====================================================================
        if (rawData.networks) metadataUpdates.networks = rawData.networks.map((n: any) => n.name)
        if (rawData.created_by) metadataUpdates.created_by = rawData.created_by.map((c: any) => c.name)
        updateField(enriched, existingItem, 'number_of_seasons', rawData.number_of_seasons, force)
        updateField(enriched, existingItem, 'number_of_episodes', rawData.number_of_episodes, force)
        if (rawData.first_air_date) metadataUpdates.first_air_date = rawData.first_air_date
        if (rawData.last_air_date) metadataUpdates.last_air_date = rawData.last_air_date

        // =====================================================================
        // OVERVIEW (TMDB's description - useful for embeddings even if we generate our own)
        // =====================================================================
        if (rawData.overview) {
            metadataUpdates.tmdb_overview = rawData.overview
        }

        // =====================================================================
        // EXTERNAL IDS
        // =====================================================================
        if (rawData.external_ids?.imdb_id) {
            enriched.external_ids = {
                ...existingItem.external_ids,
                imdb: rawData.external_ids.imdb_id,
                tmdb: rawData.id
            }
        }

        // Merge metadata updates
        if (Object.keys(metadataUpdates).length > 0) {
            enriched.metadata = { ...existingItem.metadata, ...metadataUpdates }
        }

        return enriched
    }
}

export default TMDBProvider
