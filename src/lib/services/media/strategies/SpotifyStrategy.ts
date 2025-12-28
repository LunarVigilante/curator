import { MediaStrategy, MediaResult, MediaSearchResponse } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';

/**
 * Enhanced Spotify Strategy
 * 
 * IMPORTANT: As of November 27, 2024, Spotify deprecated Audio Features API for new apps.
 * Mood analysis now uses genre-based approximation instead.
 * 
 * Artist Flow:
 * 1. Search → Get artist list
 * 2. Fetch Top Tracks → For "Greatest Hits" context and era analysis
 * 
 * Album Flow:
 * 1. Search → Get album list
 * 2. Fetch Artist details → Get genres + followers
 * 3. Fetch Album details → Get label + popularity
 */
export class SpotifyStrategy implements MediaStrategy {
    name = "Spotify";
    description = "Search for artists and albums using Spotify API with enhanced metadata";

    // Token Caching
    private static accessToken: string | null = null;
    private static tokenExpiresAt: number = 0;

    private async getSpotifyToken(settings: SystemSettings): Promise<string> {
        // Check if token is valid (with 5 min buffer)
        if (SpotifyStrategy.accessToken && Date.now() < SpotifyStrategy.tokenExpiresAt - 300000) {
            return SpotifyStrategy.accessToken;
        }

        const clientId = settings['spotify_client_id'];
        const clientSecret = settings['spotify_client_secret'];

        if (!clientId || !clientSecret) {
            throw new Error("Missing Spotify Client ID or Secret in settings");
        }

        try {
            const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Spotify Auth Failed: ${error.error_description || response.statusText}`);
            }

            const data = await response.json();

            SpotifyStrategy.accessToken = data.access_token;
            SpotifyStrategy.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

            return data.access_token;

        } catch (error) {
            console.error("Spotify Token Error:", error);
            throw error;
        }
    }

    /**
     * Fetch artist details to get genres and followers
     */
    private async fetchArtist(token: string, artistId: string, apiUrl: string): Promise<{
        genres: string[];
        followers: number;
        popularity: number;
    }> {
        try {
            const response = await fetch(`${apiUrl}/artists/${artistId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                console.warn(`Failed to fetch artist ${artistId}`);
                return { genres: [], followers: 0, popularity: 0 };
            }

            const artist = await response.json();
            return {
                genres: artist.genres || [],
                followers: artist.followers?.total || 0,
                popularity: artist.popularity || 0
            };
        } catch (error) {
            console.error("Failed to fetch artist:", error);
            return { genres: [], followers: 0, popularity: 0 };
        }
    }

    /**
     * Fetch artist's top tracks for context and era analysis
     * Returns top 5 track names and release years
     */
    private async fetchTopTracks(token: string, artistId: string, apiUrl: string): Promise<{
        tracks: Array<{ name: string; year: number | null; albumName: string }>;
        eraDescription: string;
    }> {
        try {
            const response = await fetch(`${apiUrl}/artists/${artistId}/top-tracks?market=US`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                console.warn(`Failed to fetch top tracks for artist ${artistId}`);
                return { tracks: [], eraDescription: '' };
            }

            const data = await response.json();
            const topTracks = data.tracks?.slice(0, 5).map((t: any) => ({
                name: t.name,
                year: t.album?.release_date ? parseInt(t.album.release_date.substring(0, 4)) : null,
                albumName: t.album?.name || ''
            })) || [];

            // Calculate era description based on track years
            const years = topTracks.map((t: any) => t.year).filter((y: number | null) => y !== null) as number[];
            const eraDescription = this.getEraDescription(years);

            return { tracks: topTracks, eraDescription };
        } catch (error) {
            console.error("Failed to fetch top tracks:", error);
            return { tracks: [], eraDescription: '' };
        }
    }

    /**
     * Get era description based on release years
     */
    private getEraDescription(years: number[]): string {
        if (years.length === 0) return '';

        const avgYear = Math.round(years.reduce((a, b) => a + b, 0) / years.length);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const currentYear = new Date().getFullYear();

        // Determine era
        if (avgYear >= currentYear - 3) return 'Contemporary';
        if (avgYear >= 2010) return '2010s';
        if (avgYear >= 2000) return '2000s';
        if (avgYear >= 1990) return '90s';
        if (avgYear >= 1980) return '80s';
        if (avgYear >= 1970) return '70s';
        if (avgYear >= 1960) return '60s';
        return 'Classic';
    }

    /**
     * Fetch full album details to get label and popularity
     */
    private async fetchAlbum(token: string, albumId: string, apiUrl: string): Promise<{
        label: string;
        popularity: number;
        copyrights: string[];
    }> {
        try {
            const response = await fetch(`${apiUrl}/albums/${albumId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                console.warn(`Failed to fetch album ${albumId}`);
                return { label: '', popularity: 0, copyrights: [] };
            }

            const album = await response.json();
            return {
                label: album.label || '',
                popularity: album.popularity || 0,
                copyrights: album.copyrights?.map((c: any) => c.text) || []
            };
        } catch (error) {
            console.error("Failed to fetch album details:", error);
            return { label: '', popularity: 0, copyrights: [] };
        }
    }

    /**
     * Get mood/vibe description based on genres (since Audio Features API is deprecated)
     * This uses genre-based inference instead of actual audio analysis
     */
    private getGenreBasedMood(genres: string[]): string {
        const moods: string[] = [];
        const genreString = genres.join(' ').toLowerCase();

        // Energy indicators
        if (/punk|metal|hardcore|thrash|industrial|noise/.test(genreString)) {
            moods.push('Aggressive');
        } else if (/electronic|dance|edm|house|techno|dubstep/.test(genreString)) {
            moods.push('Energetic');
        } else if (/chill|ambient|lo-fi|lofi|downtempo|new age/.test(genreString)) {
            moods.push('Mellow');
        }

        // Mood indicators
        if (/sad|melancholy|emo|goth|doom|dark/.test(genreString)) {
            moods.push('Melancholic');
        } else if (/happy|pop|indie pop|sunshine|bubblegum/.test(genreString)) {
            moods.push('Upbeat');
        }

        // Style indicators
        if (/acoustic|folk|singer-songwriter|unplugged/.test(genreString)) {
            moods.push('Acoustic');
        }
        if (/party|club|disco|funk|dance/.test(genreString)) {
            moods.push('Danceable');
        }
        if (/romantic|love|soul|r&b/.test(genreString)) {
            moods.push('Soulful');
        }

        return moods.slice(0, 3).join(', ') || 'Mixed';
    }

    /**
     * Format follower count for display
     */
    private formatFollowers(count: number): string {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M followers`;
        if (count >= 1000) return `${(count / 1000).toFixed(0)}K followers`;
        return `${count} followers`;
    }

    async search(query: string, settings: SystemSettings, type?: string): Promise<MediaSearchResponse> {
        try {
            const token = await this.getSpotifyToken(settings);
            const apiUrl = settings['spotify_api_url'] || 'https://api.spotify.com/v1';

            // Determine search type from category type
            let searchType: 'artist' | 'album' = 'artist';
            if (type) {
                const lowerType = type.toLowerCase();
                if (lowerType.includes('album') || lowerType === 'music_album') {
                    searchType = 'album';
                }
            }

            const response = await fetch(`${apiUrl}/search?q=${encodeURIComponent(query)}&type=${searchType}&limit=5`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                return { success: false, data: [], error: `Spotify Error: ${response.statusText}` };
            }

            const data = await response.json();

            // =============================
            // ARTIST SEARCH (with top tracks and era analysis)
            // =============================
            if (searchType === 'artist') {
                if (!data.artists || !data.artists.items) return { success: true, data: [] };

                // Process artists with enhanced metadata (parallel fetching)
                const resultsPromises = data.artists.items.slice(0, 5).map(async (item: any) => {
                    const image = item.images && item.images.length > 0 ? item.images[0].url : null;

                    // Fetch top tracks for this artist
                    const topTracksData = await this.fetchTopTracks(token, item.id, apiUrl);

                    // Build description with genres and era
                    const descParts: string[] = [];
                    if (item.genres && item.genres.length > 0) {
                        descParts.push(item.genres.slice(0, 2).join(', '));
                    }
                    if (topTracksData.eraDescription) {
                        descParts.push(topTracksData.eraDescription);
                    }
                    if (item.followers?.total) {
                        descParts.push(this.formatFollowers(item.followers.total));
                    }

                    // Get genre-based mood
                    const mood = this.getGenreBasedMood(item.genres || []);

                    // Build AI analysis payload for vector embeddings
                    const analysisPayload = `Artist: ${item.name}. Genres: ${(item.genres || []).join(", ")}. Popularity: ${item.popularity}/100. Top Hits: ${topTracksData.tracks.map(t => t.name).join(", ")}.`;

                    return {
                        id: `spotify-${item.id}`,
                        type: 'music_artist',
                        title: item.name,
                        description: descParts.join(' • ') || 'Music Artist',
                        imageUrl: image,
                        year: undefined,
                        tags: item.genres?.slice(0, 5) || [],
                        metadata: JSON.stringify({
                            spotifyId: item.id,
                            type: 'artist',
                            url: item.external_urls?.spotify,
                            // Display Data
                            genres: item.genres || [],
                            followers: item.followers?.total || 0,
                            popularity: item.popularity || 0,
                            // Top Tracks (Critical for "Vibe")
                            topTracks: topTracksData.tracks,
                            era: topTracksData.eraDescription,
                            // Mood (genre-based inference)
                            mood: mood,
                            // AI Analysis Payload (for embeddings)
                            analysisPayload: analysisPayload
                        })
                    };
                });

                const results = await Promise.all(resultsPromises);
                return { success: true, data: results };
            }

            // =============================
            // ALBUM SEARCH (with enhanced metadata, no audio features)
            // =============================
            if (!data.albums || !data.albums.items) return { success: true, data: [] };

            // Process albums with enhanced metadata (parallel fetching)
            const resultsPromises = data.albums.items.slice(0, 5).map(async (item: any) => {
                const image = item.images && item.images.length > 0 ? item.images[0].url : null;
                const releaseYear = item.release_date ? parseInt(item.release_date.substring(0, 4)) : undefined;
                const artists = item.artists?.map((a: any) => a.name).join(', ') || '';
                const primaryArtistId = item.artists?.[0]?.id;

                // Fetch additional metadata in parallel
                const [artistData, albumData] = await Promise.all([
                    primaryArtistId ? this.fetchArtist(token, primaryArtistId, apiUrl) : Promise.resolve({ genres: [], followers: 0, popularity: 0 }),
                    this.fetchAlbum(token, item.id, apiUrl)
                ]);

                // Get genre-based mood (since Audio Features API is deprecated)
                const mood = this.getGenreBasedMood(artistData.genres);

                // Build enhanced description
                const descParts: string[] = [`by ${artists}`];
                if (artistData.genres.length > 0) {
                    descParts.push(`[${artistData.genres.slice(0, 2).join(', ')}]`);
                }
                if (mood && mood !== 'Mixed') {
                    descParts.push(`• ${mood}`);
                }

                // Build AI analysis payload for vector embeddings
                const analysisPayload = `Album: ${item.name} by ${artists}. Genres: ${artistData.genres.join(", ")}. Label: ${albumData.label}. Released: ${item.release_date}. ${item.total_tracks} tracks.`;

                return {
                    id: `spotify-${item.id}`,
                    type: 'music_album',
                    title: item.name,
                    description: descParts.join(' '),
                    imageUrl: image,
                    year: releaseYear,
                    tags: artistData.genres.slice(0, 5),
                    metadata: JSON.stringify({
                        spotifyId: item.id,
                        type: 'album',
                        url: item.external_urls?.spotify,
                        // Display Data
                        artists: artists,
                        artistIds: item.artists?.map((a: any) => a.id) || [],
                        releaseDate: item.release_date,
                        totalTracks: item.total_tracks,
                        albumType: item.album_type,
                        // Artist Data (for AI/Vector)
                        genres: artistData.genres,
                        artistFollowers: artistData.followers,
                        artistPopularity: artistData.popularity,
                        // Album Data
                        label: albumData.label,
                        albumPopularity: albumData.popularity,
                        // Mood (genre-based inference since Audio Features deprecated Nov 2024)
                        mood: mood,
                        // AI Analysis Payload (for embeddings)
                        analysisPayload: analysisPayload
                    })
                };
            });

            const results = await Promise.all(resultsPromises);

            return { success: true, data: results };

        } catch (error: any) {
            console.error("Spotify search failed:", error);
            const isConfigError = error.message?.includes('Missing Spotify');
            return {
                success: false,
                data: [],
                error: isConfigError ? 'Spotify settings missing' : 'Spotify unreachable'
            };
        }
    }
}
