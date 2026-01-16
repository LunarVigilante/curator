import {
    type ImportStrategy,
    type ParsedImport,
    type ParsedImportItem,
    URL_PATTERNS
} from '@/lib/types/import'

interface SpotifyToken {
    access_token: string;
    expires_in: number;
}

interface SpotifyTrack {
    track: {
        name: string;
        artists: { name: string }[];
        album: { name: string; release_date: string };
    };
}

export class SpotifyAdapter implements ImportStrategy {
    name = 'SpotifyAdapter'
    private clientId = process.env.SPOTIFY_CLIENT_ID
    private clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    canHandle(input: string): boolean {
        return URL_PATTERNS.SPOTIFY_PLAYLIST.test(input)
    }

    async parse(input: string): Promise<ParsedImport> {
        const playlistId = this.extractPlaylistId(input)
        if (!playlistId) {
            throw new Error('Invalid Spotify playlist URL')
        }

        const token = await this.getAccessToken()
        if (!token) {
            throw new Error('Failed to authenticate with Spotify')
        }

        const playlistData = await this.fetchPlaylistData(token, playlistId)
        const items = await this.fetchPlaylistTracks(token, playlistId)

        return {
            source: 'spotify_playlist',
            collectionTitle: playlistData.name,
            collectionDescription: playlistData.description,
            mediaType: 'music',
            items: items.map((item, index) => ({
                title: item.track.name,
                artist: item.track.artists.map(a => a.name).join(', '),
                releaseYear: item.track.album.release_date ? parseInt(item.track.album.release_date.split('-')[0]) : undefined,
                rank: index + 1,
                mediaType: 'music',
                confidence: 1,
                rawInput: `${item.track.name} - ${item.track.artists.map(a => a.name).join(', ')}`
            })),
            parseConfidence: 1
        }
    }

    private extractPlaylistId(url: string): string | null {
        const match = url.match(/playlist\/([a-zA-Z0-9]+)/)
        return match ? match[1] : null
    }

    private async getAccessToken(): Promise<string | null> {
        if (!this.clientId || !this.clientSecret) return null

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
                },
                body: 'grant_type=client_credentials'
            })

            if (!response.ok) return null
            const data: SpotifyToken = await response.json()
            return data.access_token
        } catch (error) {
            console.error('[SpotifyAdapter] Auth error:', error)
            return null
        }
    }

    private async fetchPlaylistData(token: string, playlistId: string): Promise<{ name: string, description: string }> {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,description`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch playlist data: ${response.status}`)
        }

        return await response.json()
    }

    private async fetchPlaylistTracks(token: string, playlistId: string): Promise<SpotifyTrack[]> {
        const tracks: SpotifyTrack[] = []
        let offset = 0
        const limit = 100
        let next = true

        while (next) {
            const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}&fields=items(track(name,artists(name),album(name,release_date))),next`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (!response.ok) break

            const data = await response.json()
            if (data.items) {
                tracks.push(...data.items.filter((i: any) => i.track)) // Filter out null tracks
            }

            if (!data.next) {
                next = false
            } else {
                offset += limit
            }
        }

        return tracks
    }
}
