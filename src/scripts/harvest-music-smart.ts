import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { TheAudioDBService } from '@/lib/services/theaudiodb';
import { generateEmbeddingsBatch } from '@/lib/services/search';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, sleep, aiLimiter, decodeHTMLEntities } from '@/lib/harvesters/shared';
// @ts-ignore
import pLimit from 'p-limit';

// Config
const START_YEAR = 2026;
const END_YEAR = 1980;
const CONCURRENCY = 1; // Strict 1 is safest for deep harvesting
const DELAY_BETWEEN_ALBUMS = 2000; // 2s for AudioDB

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// ============================================================================
// SPOTIFY HELPER
// ============================================================================
class SpotifyHelper {
    private token: string | null = null;
    private clientId = process.env.SPOTIFY_CLIENT_ID;
    private clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    private tokenExpiresAt = 0;

    async getAccessToken(): Promise<string | null> {
        if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
        if (!this.clientId || !this.clientSecret) return null;

        try {
            const res = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64')
                },
                body: 'grant_type=client_credentials'
            });

            const data = await res.json();
            if (data.access_token) {
                this.token = data.access_token;
                this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // Buffer
                return this.token;
            }
            return null;
        } catch (err) {
            console.error('❌ Spotify Auth Error:', err);
            return null;
        }
    }

    async fetch(endpoint: string): Promise<any> {
        const token = await this.getAccessToken();
        if (!token) return null;

        const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get('Retry-After') || '5');
            console.warn(`   ⚠️ Spotify Rate Limit. Sleeping ${retryAfter}s...`);
            await sleep(retryAfter * 1000);
            return this.fetch(endpoint);
        }

        if (!res.ok) return null;
        return await res.json();
    }

    // UPDATED: Deep pagination
    async searchAlbumsByYear(year: number, offset = 0) {
        // Spotify typically limits offset to 1000 for search. To go deeper, we'd need more specific queries,
        // but for now, we'll hit the max allowed offset.
        const q = encodeURIComponent(`year:${year} tag:new`); // Adding tag:new helps surface notable releases sometimes, but pure year is broader. 
        // Let's stick to `year:${year}` for broad coverage. 
        // Max limit is 50.
        const query = encodeURIComponent(`year:${year}`);
        const data = await this.fetch(`/search?q=${query}&type=album&limit=50&offset=${offset}`);
        return data?.albums?.items || [];
    }

    async getFullAlbum(id: string) {
        return await this.fetch(`/albums/${id}`);
    }

    async getAudioFeatures(trackIds: string[]) {
        if (trackIds.length === 0) return {};
        // Batched request (up to 100)
        // Split into chunks of 100
        const map: Record<string, any> = {};

        for (let i = 0; i < trackIds.length; i += 100) {
            const chunk = trackIds.slice(i, i + 100);
            const data = await this.fetch(`/audio-features?ids=${chunk.join(',')}`);
            if (data?.audio_features) {
                data.audio_features.forEach((f: any) => {
                    if (f) map[f.id] = f;
                });
            }
        }
        return map;
    }

    async getArtist(id: string) {
        return await this.fetch(`/artists/${id}`);
    }
}

const spotify = new SpotifyHelper();

// ============================================================================
// MAIN HARVESTER
// ============================================================================

// We cache artist IDs locally to avoid re-fetching/re-embedding the same artist 50 times
const processedArtists = new Set<string>();

async function startHarvest() {
    console.log(`🚀 STARTING SMART MUSIC HARVEST (Artist -> Album -> Track)`);
    console.log(`   📅 Years: ${START_YEAR} -> ${END_YEAR}`);
    console.log(`   🎯 Mode: DEEP HARVEST (Max Pagination)`);

    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);
        let totalFetched = 0;
        let emptyBatches = 0;

        // Spotify Search API limit is usually 1,000 items (offset 0 to 950).
        // To get "absolute max", we loop until we hit the empty return or the API limit.
        const MAX_OFFSET = 1000;

        for (let offset = 0; offset <= MAX_OFFSET; offset += 50) {
            process.stdout.write(`   � Offset ${offset}... `);
            const albums = await spotify.searchAlbumsByYear(year, offset);

            if (!albums || albums.length === 0) {
                console.log('Done (No more results).');
                break;
            }

            process.stdout.write(`Found ${albums.length}. Processing...\n`);

            for (const album of albums) {
                // Serial execution to respect AudioDB delay
                await processFullHierarchy(album.id, year);
            }
            totalFetched += albums.length;

            // Respect rate limits between batches slightly
            await sleep(500);
        }
        console.log(`   ✅ Year ${year} Complete. Fetched ${totalFetched} albums.`);
    }
}

async function processFullHierarchy(albumId: string, year: number) {
    // 1. Fetch Full Album (includes Tracks info)
    const album = await spotify.getFullAlbum(albumId);
    if (!album) return;

    // Skip singles if we only want albums? The prompt said "albums AND artists", implying all releases.
    // But singles clutter quickly. Let's keep them but categorize correctly.

    // Safety check for empty artists
    if (!album.artists || album.artists.length === 0) return;

    const artistSimple = album.artists[0]; // Primary artist
    const artistName = decodeHTMLEntities(artistSimple.name);
    const albumTitle = decodeHTMLEntities(album.name);

    // console.log(`      🎵 [${artistName}] ${albumTitle}`);

    // ======================================================
    // LEVEL 1: ARTIST (Upsert if new)
    // ======================================================
    if (!processedArtists.has(artistSimple.id)) {
        const fullArtist = await spotify.getArtist(artistSimple.id);
        if (fullArtist) {
            const artistImg = fullArtist.images?.[0]?.url;
            const hostedArtistImg = await imageService.processAndUpload(artistImg, 'music');

            // Simple AI Gen for Artist
            const artistDesc = await aiLimiter(() =>
                rewriteDescription(supabase, artistName, `Music Artist. Genres: ${fullArtist.genres.join(', ')}`, 'MUSIC_ARTIST')
            );

            // Start check-then-upsert for ARTIST
            const { data: existingArtist } = await supabase
                .from('global_items')
                .select('id, description_parts')
                .contains('external_ids', { spotify: fullArtist.id })
                .maybeSingle();

            const artistPayload = {
                title: artistName,
                category_type: 'MUSIC_ARTIST',
                description: artistDesc,
                image_url: hostedArtistImg,
                genres: fullArtist.genres,
                followers: fullArtist.followers?.total,
                popularity: fullArtist.popularity,
                external_ids: { spotify: fullArtist.id },
                metadata: { source: 'spotify_smart' },
                last_metadata_update: new Date().toISOString()
            };

            // Artist Update
            if (existingArtist) {
                const updatePayload = { ...artistPayload };
                // STRICT SAFETY: Never overwrite description/image on update
                delete (updatePayload as any).description;
                delete (updatePayload as any).image_url;

                const { error } = await (supabase.from('global_items') as any)
                    .update(updatePayload)
                    .eq('id', (existingArtist as any).id);
                if (error) console.error(`❌ Error updating artist ${artistName}:`, error);
            } else {
                // Insert
                const { error } = await (supabase.from('global_items') as any).insert(artistPayload);
                if (error && error.code !== '23505') console.error(`❌ Error inserting artist ${artistName}:`, error);
            }

            // console.log(`      👤 Saved Artist: ${artistName}`);
        }
        processedArtists.add(artistSimple.id);
    }

    // ======================================================
    // LEVEL 2: ALBUM (ALWAYS process - not inside artist check!)
    // ======================================================

    let coverUrl = album.images?.[0]?.url;
    const hostedAlbumImg = await imageService.processAndUpload(coverUrl, 'music');

    // AI Description for Album
    // RICH CONTEXT for Album
    const richContext = `
Album: ${albumTitle} (${year})
Artist: ${artistName}
Type: ${album.album_type}
Tracks: ${album.total_tracks}
Genres: ${album.genres.join(', ') || 'N/A'}
    `.trim();

    const albumDesc = await aiLimiter(() => rewriteDescription(supabase, albumTitle, richContext, 'MUSIC_ALBUM'));

    const contextTags = `${album.genres.join(', ')} ${artistName}`;
    const tags = await aiLimiter(() => generateTags(supabase, albumTitle, `${albumDesc} ${contextTags}`, 'MUSIC_ALBUM'));
    const validTags = await ensureTags(supabase, tags);

    const albumPayload = {
        title: albumTitle,
        category_type: 'MUSIC_ALBUM',
        description: albumDesc,
        image_url: hostedAlbumImg,
        release_year: year,
        release_date: album.release_date,
        genres: album.genres.length ? album.genres : [],
        album_type: album.album_type,
        total_tracks: album.total_tracks,
        label: album.label,
        popularity: album.popularity,
        upc: album.external_ids?.upc,
        external_ids: { spotify: album.id },
        metadata: { source: 'spotify_smart' },
        cached_tags: validTags,
        last_metadata_update: new Date().toISOString()
    };

    // Safe Upsert for Album
    const { data: existingAlbum } = await supabase
        .from('global_items')
        .select('id, description_parts')
        .contains('external_ids', { spotify: album.id })
        .maybeSingle();

    if (existingAlbum) {
        // STRICT SAFETY: Never overwrite description/tags on update
        const updatePayload = { ...albumPayload };
        delete (updatePayload as any).description;
        delete (updatePayload as any).image_url;
        delete (updatePayload as any).cached_tags;

        await (supabase.from('global_items') as any).update(updatePayload).eq('id', (existingAlbum as any).id);
    } else {
        const { error } = await (supabase.from('global_items') as any).insert(albumPayload);
        if (error && error.code !== '23505') console.error(`❌ Error inserting album ${albumTitle}:`, error);
    }

    // ======================================================
    // LEVEL 3: TRACKS (ALWAYS process - With Audio Features)
    // ======================================================

    const tracks = album.tracks?.items || [];
    if (tracks.length === 0) return;

    // Fetch Vibe Data for all tracks at once
    const trackIds = tracks.map((t: any) => t.id);
    const featuresMap = await spotify.getAudioFeatures(trackIds);

    // Filter out existing tracks to avoid massive unnecessary reads/writes?
    // Optimization: Just do the safe check logic

    // 1. Prepare all texts
    const trackPayloads: any[] = [];
    const vectorTexts: string[] = [];

    for (const track of tracks) {
        const features = featuresMap[track.id];
        const trackTitle = decodeHTMLEntities(track.name);

        // Vibe String for Vector
        const vibeStr = features ?
            `Danceability: ${features.danceability}, Energy: ${features.energy}, Tempo: ${features.tempo} BPM, Valence: ${features.valence}`
            : '';

        const vectorText = `
        Title: ${trackTitle}
        Artist: ${artistName}
        Album: ${albumTitle}
        Vibe: ${vibeStr}
    `.trim();

        vectorTexts.push(vectorText);

        trackPayloads.push({
            track,
            trackTitle,
            features,
            vectorText
        });
    }

    // 2. Generate embeddings in batch
    const embeddings = await generateEmbeddingsBatch(vectorTexts);

    // 3. Process DB operations in parallel
    const trackLimit = pLimit(10); // Concurrent DB ops limit
    await Promise.all(trackPayloads.map((payload, i) => trackLimit(async () => {
        const { track, trackTitle, features } = payload;
        const embedding = embeddings[i];

        const trackData = {
            title: trackTitle,
            category_type: 'MUSIC_TRACK',
            description: `Track ${track.track_number} on ${albumTitle}`,
            image_url: hostedAlbumImg,
            duration_ms: track.duration_ms,
            preview_url: track.preview_url,
            isrc: track.external_ids?.isrc,
            audio_features: features,
            artist_names: track.artists.map((a: any) => decodeHTMLEntities(a.name)),
            album_name: albumTitle,
            track_number: track.track_number,
            external_ids: { spotify: track.id },
            metadata: { source: 'spotify_smart' },
            vector_text: JSON.stringify(embedding),
            last_metadata_update: new Date().toISOString()
        };

        const { data: existingTrack } = await supabase
            .from('global_items')
            .select('id, description_parts')
            .contains('external_ids', { spotify: track.id })
            .maybeSingle();

        if (existingTrack) {
            // STRICT SAFETY: Never overwrite description on update
            const updatePayload = { ...trackData };
            delete (updatePayload as any).description;
            delete (updatePayload as any).vector_text;

            await (supabase.from('global_items') as any).update(updatePayload).eq('id', (existingTrack as any).id);
        } else {
            const { error } = await (supabase.from('global_items') as any).insert(trackData);
            if (error && error.code !== '23505') console.error(`❌ Error inserting track ${trackTitle}:`, error);
        }
    })));

    // console.log(`      💿 Saved Album + ${tracks.length} Tracks.`);
}

startHarvest().catch(console.error);
