/**
 * Music Harvester - Spotify API
 * Fetches top artists and albums using Spotify's Client Credentials Flow
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding } from './shared';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const API_DELAY_MS = 200;
const LIMIT = 100;

interface SpotifyToken {
    access_token: string;
    expires_in: number;
}

interface SpotifyArtist {
    id: string;
    name: string;
    images: { url: string }[];
    genres: string[];
    popularity: number;
    followers: { total: number };
}

interface SpotifyAlbum {
    id: string;
    name: string;
    images: { url: string }[];
    artists: { name: string }[];
    release_date: string;
    total_tracks: number;
    album_type: string;
}

// Get Spotify access token using Client Credentials Flow
async function getSpotifyToken(): Promise<string | null> {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) throw new Error(`Spotify auth error: ${response.status}`);
        const data: SpotifyToken = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('❌ Spotify token error:', error);
        return null;
    }
}

// Fetch featured playlists and extract artists
async function fetchTopArtists(token: string): Promise<SpotifyArtist[]> {
    const artists: SpotifyArtist[] = [];
    const artistIds = new Set<string>();

    // Search for various popular artists
    const searches = ['pop', 'rock', 'hip hop', 'r&b', 'indie', 'electronic', 'jazz', 'classical'];

    for (const genre of searches) {
        try {
            const url = `https://api.spotify.com/v1/search?q=genre:${encodeURIComponent(genre)}&type=artist&limit=15`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) continue;
            const data = await response.json();

            for (const artist of data.artists?.items || []) {
                if (!artistIds.has(artist.id) && artist.popularity > 50) {
                    artistIds.add(artist.id);
                    artists.push(artist);
                }
            }
            await sleep(API_DELAY_MS);
        } catch {
            // Continue with next genre
        }
    }

    return artists.slice(0, LIMIT);
}

export async function harvestMusic(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎵 HARVESTING MUSIC (Spotify)...');

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        console.error('❌ SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not set');
        return { success: 0, skipped: 0, failed: 0, category: 'Music' };
    }

    const token = await getSpotifyToken();
    if (!token) {
        console.error('❌ Failed to get Spotify token');
        return { success: 0, skipped: 0, failed: 0, category: 'Music' };
    }

    const artists = await fetchTopArtists(token);
    console.log(`📊 Fetched ${artists.length} artists`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < artists.length; i++) {
        const artist = artists[i];
        const originalDesc = artist.genres.length > 0
            ? `${artist.name} is a ${artist.genres.slice(0, 3).join(', ')} artist with ${artist.followers?.total?.toLocaleString() || 'many'} followers.`
            : `${artist.name} is a popular music artist.`;

        // AI rewrite with limiter
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, artist.name, originalDesc, 'Music Artist')
        );

        // Generate embedding
        const embedding = await generateEmbedding(`${artist.name}: ${description}`);

        const item: HarvestItem = {
            title: artist.name,
            description,
            image_url: artist.images?.[0]?.url || null,
            category_type: 'MUSIC_ARTIST',
            external_ids: { spotify_artist: artist.id },
            metadata: {
                genres: artist.genres,
                popularity: artist.popularity,
                followers: artist.followers?.total,
                source: 'spotify_harvest'
            },
            ...(embedding ? { embedding } : {})
        };

        const result = await upsertItem(supabase, item, 'spotify_artist', artist.id);
        if (result) success++;
        else failed++;

        if ((i + 1) % 25 === 0) {
            console.log(`   🎵 Music: ${i + 1}/${artists.length} (${success} added)`);
        }

        await sleep(100);
    }

    console.log(`✅ Music: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Music' };
}
