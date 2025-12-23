import { MediaResult, MediaStrategy } from "../types";

export class TmdbStrategy implements MediaStrategy {
    name = "Movies & TV";

    private genreMap: Record<number, string> = {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
        99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
        27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
        10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
        10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
        10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
    };

    async search(query: string, settings: Record<string, string>): Promise<MediaResult[]> {
        const apiKey = settings['tmdb_api_key'];
        if (!apiKey) {
            console.warn("TMDB API Key missing");
            return [];
        }

        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`);
            if (!res.ok) return [];

            const data = await res.json();

            return (data.results || [])
                .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
                .map((item: any) => {
                    const isMovie = item.media_type === 'movie';
                    return {
                        id: `tmdb-${item.id}`,
                        type: item.media_type,
                        title: isMovie ? item.title : item.name,
                        description: item.overview || "No description available.",
                        imageUrl: item.poster_path
                            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                            : "",
                        year: (isMovie ? item.release_date : item.first_air_date)?.split('-')[0] || "",
                        tags: (item.genre_ids || []).map((id: number) => this.genreMap[id]).filter(Boolean),
                        metadata: JSON.stringify({
                            media_type: item.media_type,
                            original_title: isMovie ? item.original_title : item.original_name,
                            popularity: item.popularity
                        })
                    };
                });
        } catch (error) {
            console.error("TMDB API error:", error);
            return [];
        }
    }
}
