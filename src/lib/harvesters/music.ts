/**
 * Music Harvester - Spotify API (Massive Import)
 * Fetches artists/albums from official Spotify playlists
 * Uses a list of curated playlist IDs to extract unique artists
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, upsertItem, generateEmbedding, generateTags, ensureTags } from './shared';
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const API_DELAY_MS = 100;  // Spotify is generous with rate limits

// Official Spotify playlist IDs for diverse music discovery
const PLAYLIST_IDS = [
    '37i9dQZEVXbMDoHDwVN2tF',  // Global Top 50
    '37i9dQZEVXbLiRSasKsNU9',  // Viral 50 Global
    '37i9dQZF1DXcBWIGoYBM5M',  // Today's Top Hits
    '37i9dQZF1DX0XUsuxWHRQd',  // RapCaviar
    '37i9dQZF1DX4SBhb3fqCJd',  // Are & Be (R&B)
    '37i9dQZF1DWXRqgorJj26U',  // Rock Classics
    '37i9dQZF1DX4pB1kN9pVTW',  // Hot Country
    '37i9dQZF1DX4JAvHpjipBk',  // New Music Friday
    '37i9dQZF1DX0h0QnLkMBl4',  // Peaceful Piano
    '37i9dQZF1DX1lVhptIYRda',  // Hot Hits UK
    '37i9dQZF1DX4UtSsGT1Sbe',  // All Out 80s
    '37i9dQZF1DX4o1oenSJRJd',  // All Out 90s
    '37i9dQZF1DX4o1oenSJRJd',  // All Out 2000s
    '37i9dQZF1DX3rxVfibe1L0',  // Mood Booster
    '37i9dQZF1DWWEJlAGA9gs0',  // Classical Essentials
    '37i9dQZF1DX0SM0LYsmbMT',  // Jazz Classics
    '37i9dQZF1DX8tZsk68tuDw',  // Dance Rising
    '37i9dQZF1DX6J5NfMJS675',  // Indie Pop
    '37i9dQZF1DX5Ejj0EkURtP',  // All Out 70s
    '37i9dQZF1DX2A29LI7xHn1',  // Beast Mode (Workout)
];

// Also search by genre for more coverage
const GENRE_SEARCHES = [
    'pop', 'rock', 'hip hop', 'r&b', 'indie', 'electronic', 'jazz', 'classical',
    'country', 'latin', 'k-pop', 'metal', 'punk', 'blues', 'soul', 'reggae',
    'folk', 'alternative', 'dance', 'gospel'
];

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

async function fetchArtistsFromPlaylist(token: string, playlistId: string): Promise<SpotifyArtist[]> {
    const artists: SpotifyArtist[] = [];
    const artistIds = new Set<string>();
    let offset = 0;
    const limit = 100;

    while (true) {
        try {
            const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}&fields=items(track(artists(id)))`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) break;
            const data = await response.json();
            const items = data.items || [];

            // Extract unique artist IDs
            for (const item of items) {
                for (const artist of item.track?.artists || []) {
                    if (artist.id && !artistIds.has(artist.id)) {
                        artistIds.add(artist.id);
                    }
                }
            }

            if (items.length < limit) break;
            offset += limit;
            await sleep(API_DELAY_MS);
        } catch {
            break;
        }
    }

    // Fetch full artist details in batches of 50
    const idsArray = Array.from(artistIds);
    for (let i = 0; i < idsArray.length; i += 50) {
        const batch = idsArray.slice(i, i + 50);
        try {
            const url = `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                artists.push(...(data.artists || []));
            }
            await sleep(API_DELAY_MS);
        } catch {
            // Continue
        }
    }

    return artists;
}

async function fetchArtistsByGenre(token: string, genre: string): Promise<SpotifyArtist[]> {
    const artists: SpotifyArtist[] = [];

    try {
        const url = `https://api.spotify.com/v1/search?q=genre:${encodeURIComponent(genre)}&type=artist&limit=50`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            artists.push(...(data.artists?.items || []));
        }
    } catch {
        // Continue
    }

    return artists;
}

export async function harvestMusic(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎵 HARVESTING MUSIC (Spotify - Deep Import)...');
    console.log(`   📋 Config: ${PLAYLIST_IDS.length} playlists + ${GENRE_SEARCHES.length} genres`);

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        console.error('❌ SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not set');
        return { success: 0, skipped: 0, failed: 0, category: 'Music' };
    }

    const token = await getSpotifyToken();
    if (!token) {
        console.error('❌ Failed to get Spotify token');
        return { success: 0, skipped: 0, failed: 0, category: 'Music' };
    }

    const allArtists: SpotifyArtist[] = [];
    const artistIds = new Set<string>();

    // Fetch from playlists
    console.log('\n   🎧 Fetching artists from playlists...');
    for (let i = 0; i < PLAYLIST_IDS.length; i++) {
        const playlistId = PLAYLIST_IDS[i];
        try {
            const artists = await fetchArtistsFromPlaylist(token, playlistId);
            for (const artist of artists) {
                if (!artistIds.has(artist.id)) {
                    artistIds.add(artist.id);
                    allArtists.push(artist);
                }
            }
            console.log(`   🎵 Playlist ${i + 1}/${PLAYLIST_IDS.length}: ${allArtists.length} unique artists`);
        } catch (error) {
            console.error(`   ❌ Playlist ${playlistId} error:`, error);
        }
        await sleep(API_DELAY_MS);
    }

    // Fetch by genre
    console.log('\n   🎸 Fetching artists by genre...');
    for (const genre of GENRE_SEARCHES) {
        const artists = await fetchArtistsByGenre(token, genre);
        for (const artist of artists) {
            if (!artistIds.has(artist.id)) {
                artistIds.add(artist.id);
                allArtists.push(artist);
            }
        }
        await sleep(API_DELAY_MS);
    }

    // Filter by popularity (at least somewhat known)
    const filteredArtists = allArtists.filter(a => a.popularity >= 30);
    console.log(`\n📊 Fetched ${filteredArtists.length} unique artists (popularity >= 30)`);

    let success = 0, failed = 0;
    const skipped = 0;

    for (let i = 0; i < filteredArtists.length; i++) {
        const artist = filteredArtists[i];
        const genres = artist.genres || [];

        try {
            const originalDesc = genres.length > 0
                ? `${artist.name} is a ${genres.slice(0, 3).join(', ')} artist with ${artist.followers?.total?.toLocaleString() || 'many'} followers.`
                : `${artist.name} is a popular music artist.`;

            // Generate 4-part structured description (parallel LLM calls)
            const description_parts = await aiLimiter(() =>
                generateStructuredDescription(supabase, {
                    title: artist.name,
                    originalDescription: originalDesc,
                    type: 'Music Artist',
                    metadata: { genres }
                })
            );

            // Combine for backwards compatibility
            const description = combineDescription(description_parts);

            // Generate tags
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, artist.name, description, 'Music Artist')
            );
            const validTags = await ensureTags(supabase, tagNames);

            const item: HarvestItem = {
                title: artist.name,
                description,
                description_parts,
                image_url: artist.images?.[0]?.url || null,
                category_type: 'MUSIC_ARTIST',
                external_ids: { spotify_artist: artist.id },
                genres,
                metadata: {
                    genres,
                    popularity: artist.popularity,
                    followers: artist.followers?.total,
                    source: 'spotify_harvest'
                },
                cached_tags: validTags
            };

            // Generate rich embedding from all item data
            const embeddingText = buildEmbeddingText(item);
            const embedding = await generateEmbedding(embeddingText);
            if (embedding) {
                item.embedding = embedding;
            }

            const result = await upsertItem(supabase, item, 'spotify_artist', artist.id);
            if (result) success++;
            else failed++;
        } catch (error) {
            console.error(`   ❌ Failed to process "${artist.name}":`, error);
            failed++;
        }

        if ((i + 1) % 100 === 0) {
            console.log(`   🎵 Music: ${i + 1}/${filteredArtists.length} (${success} added, ${failed} failed)`);
        }

        await sleep(50);
    }

    console.log(`✅ Music: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Music' };
}

