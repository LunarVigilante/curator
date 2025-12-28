import { MediaStrategy, MediaSearchResponse, MediaResult } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';

/**
 * Enhanced TMDB Strategy for Movies & TV Shows
 * 
 * Uses append_to_response to fetch all metadata in a single request:
 * - Movies: Director, Cast, Keywords, Production Companies, Budget/Revenue
 * - TV: Creator/Showrunner, Networks, Seasons, Origin Country, Keywords
 */
export class TmdbStrategy implements MediaStrategy {
    name = "Movies & TV";
    description = "Search for movies and TV shows using TMDB API with enhanced metadata";

    private genreMap: Record<number, string> = {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
        99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
        27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
        10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
        10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
        10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
    };

    /**
     * Fetch detailed movie info with credits, keywords, etc.
     */
    private async fetchMovieDetails(apiKey: string, movieId: number, apiUrl: string): Promise<{
        director: string;
        cast: string[];
        productionCompanies: string[];
        keywords: string[];
        budget: number;
        revenue: number;
        runtime: number;
        collection: string | null;
        tagline: string;
    }> {
        try {
            const response = await fetch(
                `${apiUrl}/movie/${movieId}?api_key=${apiKey}&append_to_response=credits,keywords`
            );

            if (!response.ok) {
                return this.getDefaultMovieDetails();
            }

            const data = await response.json();

            // Find director from crew
            const director = data.credits?.crew?.find((c: any) => c.job === 'Director')?.name || '';

            // Get top cast
            const cast = data.credits?.cast?.slice(0, 5).map((c: any) => c.name) || [];

            // Get production companies
            const productionCompanies = data.production_companies?.map((c: any) => c.name) || [];

            // Get keywords (Movies use keywords.keywords)
            const keywords = data.keywords?.keywords?.map((k: any) => k.name) || [];

            return {
                director,
                cast,
                productionCompanies,
                keywords: keywords.slice(0, 10),
                budget: data.budget || 0,
                revenue: data.revenue || 0,
                runtime: data.runtime || 0,
                collection: data.belongs_to_collection?.name || null,
                tagline: data.tagline || ''
            };
        } catch (error) {
            console.error("Failed to fetch movie details:", error);
            return this.getDefaultMovieDetails();
        }
    }

    private getDefaultMovieDetails() {
        return {
            director: '',
            cast: [],
            productionCompanies: [],
            keywords: [],
            budget: 0,
            revenue: 0,
            runtime: 0,
            collection: null,
            tagline: ''
        };
    }

    /**
     * Fetch detailed TV show info with credits, keywords, etc.
     */
    private async fetchTvDetails(apiKey: string, tvId: number, apiUrl: string): Promise<{
        creators: string[];
        networks: string[];
        keywords: string[];
        numberOfSeasons: number;
        numberOfEpisodes: number;
        status: string;
        originCountry: string[];
        episodeRuntime: number;
        cast: string[];
    }> {
        try {
            const response = await fetch(
                `${apiUrl}/tv/${tvId}?api_key=${apiKey}&append_to_response=credits,keywords`
            );

            if (!response.ok) {
                return this.getDefaultTvDetails();
            }

            const data = await response.json();

            // Get creators
            const creators = data.created_by?.map((c: any) => c.name) || [];

            // Get networks
            const networks = data.networks?.map((n: any) => n.name) || [];

            // Get keywords (TV uses keywords.results)
            const keywords = data.keywords?.results?.map((k: any) => k.name) || [];

            // Get top cast
            const cast = data.credits?.cast?.slice(0, 5).map((c: any) => c.name) || [];

            // Calculate average episode runtime
            const runtimeArray = data.episode_run_time || [];
            const avgRuntime = runtimeArray.length > 0
                ? Math.round(runtimeArray.reduce((a: number, b: number) => a + b, 0) / runtimeArray.length)
                : 0;

            return {
                creators,
                networks,
                keywords: keywords.slice(0, 10),
                numberOfSeasons: data.number_of_seasons || 0,
                numberOfEpisodes: data.number_of_episodes || 0,
                status: data.status || '',
                originCountry: data.origin_country || [],
                episodeRuntime: avgRuntime,
                cast
            };
        } catch (error) {
            console.error("Failed to fetch TV details:", error);
            return this.getDefaultTvDetails();
        }
    }

    private getDefaultTvDetails() {
        return {
            creators: [],
            networks: [],
            keywords: [],
            numberOfSeasons: 0,
            numberOfEpisodes: 0,
            status: '',
            originCountry: [],
            episodeRuntime: 0,
            cast: []
        };
    }

    /**
     * Get studio category based on production company
     */
    private getStudioCategory(companies: string[]): string {
        const companyStr = companies.join(' ').toLowerCase();

        // Major studios
        if (/marvel|disney|pixar|lucasfilm/.test(companyStr)) return 'Disney/Marvel';
        if (/warner|dc|wb/.test(companyStr)) return 'Warner Bros';
        if (/universal|dreamworks|illumination/.test(companyStr)) return 'Universal';
        if (/paramount|nickelodeon/.test(companyStr)) return 'Paramount';
        if (/sony|columbia/.test(companyStr)) return 'Sony';

        // Prestige/Indie
        if (/a24/.test(companyStr)) return 'A24';
        if (/blumhouse/.test(companyStr)) return 'Blumhouse';
        if (/neon/.test(companyStr)) return 'NEON';
        if (/focus|searchlight|fox searchlight/.test(companyStr)) return 'Searchlight';

        return companies[0] || 'Unknown';
    }

    /**
     * Get network prestige category
     */
    private getNetworkCategory(networks: string[]): string {
        const networkStr = networks.join(' ').toLowerCase();

        if (/hbo|max/.test(networkStr)) return 'Premium (HBO)';
        if (/netflix/.test(networkStr)) return 'Streaming (Netflix)';
        if (/amazon|prime/.test(networkStr)) return 'Streaming (Amazon)';
        if (/disney\+|disney plus/.test(networkStr)) return 'Streaming (Disney+)';
        if (/apple/.test(networkStr)) return 'Streaming (Apple TV+)';
        if (/fx|fxx/.test(networkStr)) return 'Cable (FX)';
        if (/amc/.test(networkStr)) return 'Cable (AMC)';
        if (/showtime/.test(networkStr)) return 'Premium (Showtime)';
        if (/bbc/.test(networkStr)) return 'British (BBC)';
        if (/cbs|nbc|abc|fox|cw/.test(networkStr)) return 'Broadcast';

        return networks[0] || 'Unknown';
    }

    async search(query: string, settings: SystemSettings, type?: string): Promise<MediaSearchResponse> {
        const apiKey = settings['tmdb_api_key'];
        const apiUrl = settings['tmdb_api_url'] || 'https://api.themoviedb.org/3';

        if (!apiKey) {
            console.warn("TMDB API Key missing");
            return { success: false, data: [], error: "Missing TMDB API Key" };
        }

        // Dynamic Endpoint Selection
        let endpoint = `${apiUrl}/search/multi`;
        if (type === 'tv') endpoint = `${apiUrl}/search/tv`;
        if (type === 'movie') endpoint = `${apiUrl}/search/movie`;

        try {
            const res = await fetch(`${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`);
            if (!res.ok) return { success: false, data: [], error: `TMDB Error: ${res.statusText}` };

            const data = await res.json();

            // Process results with enhanced metadata (parallel fetching)
            const resultsPromises = (data.results || [])
                .slice(0, 5)
                .map(async (item: any) => {
                    // Determine type
                    const mediaType = (type === 'tv' || type === 'movie') ? type : item.media_type;

                    // Filter out non-movie/tv items
                    if (!type && mediaType !== 'movie' && mediaType !== 'tv') return null;

                    const isMovie = mediaType === 'movie';
                    const title = item.title || item.name;
                    const year = (item.release_date || item.first_air_date)?.split('-')[0] || '';
                    const genres = (item.genre_ids || []).map((id: number) => this.genreMap[id]).filter(Boolean);

                    // Fetch detailed info
                    let details: any;
                    let keyPerson = '';
                    let descParts: string[] = [];
                    let analysisPayload = '';

                    if (isMovie) {
                        details = await this.fetchMovieDetails(apiKey, item.id, apiUrl);
                        keyPerson = details.director;

                        // Build description for movies
                        if (details.director) descParts.push(`Dir: ${details.director}`);
                        if (details.cast.length > 0) descParts.push(details.cast.slice(0, 2).join(', '));
                        if (genres.length > 0) descParts.push(genres.slice(0, 2).join(', '));
                        if (details.runtime) descParts.push(`${details.runtime}min`);

                        // Build AI analysis payload
                        analysisPayload = `Type: Movie. Title: ${title}. Director: ${details.director}. Cast: ${details.cast.join(", ")}. Studio: ${details.productionCompanies[0] || 'Unknown'}. Keywords: ${details.keywords.join(", ")}. Genre: ${genres.join(", ")}. Overview: ${item.overview || ''}`;
                    } else {
                        details = await this.fetchTvDetails(apiKey, item.id, apiUrl);
                        keyPerson = details.creators[0] || '';

                        // Build description for TV
                        if (details.networks.length > 0) descParts.push(details.networks[0]);
                        if (details.creators.length > 0) descParts.push(`by ${details.creators[0]}`);
                        if (details.numberOfSeasons) {
                            descParts.push(`${details.numberOfSeasons} season${details.numberOfSeasons > 1 ? 's' : ''}`);
                        }
                        if (genres.length > 0) descParts.push(genres.slice(0, 2).join(', '));

                        // Build AI analysis payload
                        analysisPayload = `Type: TV Show. Title: ${title}. Creator: ${details.creators.join(", ")}. Network: ${details.networks[0] || 'Unknown'}. Country: ${details.originCountry[0] || 'US'}. Status: ${details.status}. Keywords: ${details.keywords.join(", ")}. Genre: ${genres.join(", ")}. Overview: ${item.overview || ''}`;
                    }

                    // Combine keywords and genres for tags
                    const allTags = [...genres, ...(details.keywords || [])].slice(0, 10);

                    // Build metadata
                    const metadata: any = {
                        tmdbId: item.id,
                        type: mediaType,
                        originalTitle: isMovie ? item.original_title : item.original_name,
                        popularity: item.popularity,
                        voteAverage: item.vote_average,
                        voteCount: item.vote_count,
                        // Genres & Keywords
                        genres: genres,
                        keywords: details.keywords || [],
                        // Key Person
                        keyPerson: keyPerson,
                        // Cast
                        cast: details.cast || [],
                        // AI Payload
                        analysisPayload: analysisPayload
                    };

                    // Movie-specific fields
                    if (isMovie) {
                        metadata.director = details.director;
                        metadata.productionCompanies = details.productionCompanies;
                        metadata.studioCategory = this.getStudioCategory(details.productionCompanies);
                        metadata.budget = details.budget;
                        metadata.revenue = details.revenue;
                        metadata.runtime = details.runtime;
                        metadata.collection = details.collection;
                        metadata.tagline = details.tagline;
                    }

                    // TV-specific fields
                    if (!isMovie) {
                        metadata.creators = details.creators;
                        metadata.networks = details.networks;
                        metadata.networkCategory = this.getNetworkCategory(details.networks);
                        metadata.numberOfSeasons = details.numberOfSeasons;
                        metadata.numberOfEpisodes = details.numberOfEpisodes;
                        metadata.status = details.status;
                        metadata.originCountry = details.originCountry;
                        metadata.episodeRuntime = details.episodeRuntime;
                    }

                    return {
                        id: `tmdb-${item.id}`,
                        type: mediaType,
                        title: title,
                        description: descParts.join(' • ') || item.overview?.substring(0, 150) || "No description available.",
                        imageUrl: item.poster_path
                            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                            : "",
                        year: year,
                        tags: allTags,
                        metadata: JSON.stringify(metadata)
                    };
                });

            const results = (await Promise.all(resultsPromises)).filter((item): item is MediaResult => item !== null);

            return { success: true, data: results };

        } catch (error) {
            console.error("TMDB API error:", error);
            return { success: false, data: [], error: "TMDB Unreachable" };
        }
    }
}
