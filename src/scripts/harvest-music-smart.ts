
import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { TheAudioDBService } from '@/lib/services/theaudiodb';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';

// Config
const START_YEAR = 2026;
const END_YEAR = 1980;
const CONCURRENCY = 1; // Strict 1 for rate limits
const DELAY_BETWEEN_ALBUMS = 2000; // 2 seconds for AudioDB

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// ============================================================================
// SPOTIFY HELPER (Internal to script)
// ============================================================================
class SpotifyHelper {
    private token: string | null = null;
    private clientId = process.env.SPOTIFY_CLIENT_ID;
    private clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    async getAccessToken(): Promise<string | null> {
        if (this.token) return this.token;
        if (!this.clientId || !this.clientSecret) {
            console.error('❌ Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
            return null;
        }

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
                return this.token;
            }
            console.error('❌ Failed to get Spotify Token:', data);
            return null;
        } catch (err) {
            console.error('❌ Spotify Auth Error:', err);
            return null;
        }
    }

    async searchAlbumsByYear(year: number, offset = 0): Promise<any[]> {
        const token = await this.getAccessToken();
        if (!token) return [];

        const q = `year:${year}`;
        const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=50&offset=${offset}`;

        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 429) {
                    console.warn('   ⚠️ Spotify Rate Limit. Waiting 5s...');
                    await sleep(5000);
                    return this.searchAlbumsByYear(year, offset);
                }
                return [];
            }

            const data = await res.json();
            return data.albums?.items || [];
        } catch {
            return [];
        }
    }
}

const spotify = new SpotifyHelper();

// ============================================================================
// MAIN HARVESTER
// ============================================================================

const existingSpotifyIds = new Set<string>();

async function startHarvest() {
    console.log(`🚀 STARTING SMART MUSIC HARVEST`);
    console.log(`   📅 Years: ${START_YEAR} -> ${END_YEAR}`);
    console.log(`   ⚡ Concurrency: ${CONCURRENCY} (Strict Serial)`);

    // 1. Load Existing (Dedupe)
    console.log(`\n📥 Loading existing spotify_ids...`);
    const { data: existing, error } = await supabase
        .from('global_items')
        .select('external_ids')
        .not('external_ids', 'is', null);

    if (!error && existing) {
        existing.forEach((row: any) => {
            if (row.external_ids?.spotify) {
                existingSpotifyIds.add(row.external_ids.spotify);
            }
        });
    }
    console.log(`   ✅ Loaded ${existingSpotifyIds.size} existing albums.`);

    // 2. Iterate Years
    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        // Pagination: Fetch up to 200 items (4 pages of 50)
        let totalFetchedForYear = 0;
        const TARGET_PER_YEAR = 200;

        for (let offset = 0; offset < TARGET_PER_YEAR; offset += 50) {
            console.log(`   📄 Fetching Page (Offset ${offset})...`);

            const albums = await spotify.searchAlbumsByYear(year, offset);
            if (albums.length === 0) break;

            let newCount = 0;
            let skippedCount = 0;

            for (const album of albums) {
                // Dedupe
                if (existingSpotifyIds.has(album.id)) {
                    skippedCount++;
                    continue;
                }

                // Process (Serial execution to respect AudioDB delay)
                await processAlbum(album, year);
                newCount++;
            }

            totalFetchedForYear += albums.length;
            console.log(`      Page Summary: ${newCount} New, ${skippedCount} Skipped.`);
        }

        console.log(`   ✅ Year ${year} Complete. Total Fetched: ${totalFetchedForYear}`);
    }

    console.log('\n✅ MUSIC HARVEST COMPLETE');
}

async function processAlbum(album: any, year: number) {
    const artistName = album.artists?.[0]?.name || 'Unknown Artist';
    const albumTitle = album.name;
    const spotifyId = album.id;
    const spotifyImage = album.images?.[0]?.url;

    console.log(`   🎵 Processing: "${albumTitle}" by ${artistName}`);

    try {
        // Step 2: AudioDB Art (Visual Upgrade)
        // MUST Wait 2s before call
        await sleep(DELAY_BETWEEN_ALBUMS);

        let coverUrl = await TheAudioDBService.getBestAlbumCover(artistName, albumTitle);

        if (coverUrl) {
            console.log(`      ✨ Found AudioDB High-Res Cover!`);
        } else {
            // Fallback to Spotify
            // console.log(`      ⚠️ No AudioDB Cover. Using Spotify fallback.`);
            coverUrl = spotifyImage;
        }

        if (!coverUrl) {
            console.warn(`      ❌ No cover art found at all. Skipping.`);
            return;
        }

        // Step 3 & 4: Process Image & Upload
        const finalImageUrl = await imageService.processAndUpload(coverUrl, 'music');
        if (!finalImageUrl) return;

        // Step 5: Metadata & AI
        const categoryType = 'ALBUM';
        const baseDesc = `${albumTitle} is an album by ${artistName}, released in ${year}. Contains ${album.total_tracks} tracks.`;

        const description = await aiLimiter(() =>
            rewriteDescription(supabase, albumTitle, baseDesc, categoryType)
        );

        // Tags
        const tagNames = await aiLimiter(() =>
            generateTags(supabase, albumTitle, description, categoryType)
        );
        const validTags = await ensureTags(supabase, tagNames);
        const embedding = await generateEmbedding(`${albumTitle} ${artistName}: ${description}`);

        // Construct Item
        const newItem: any = {
            title: albumTitle,
            description: description,
            image_url: finalImageUrl,
            category_type: categoryType,
            source: 'spotify', // Required for unique constraint
            external_id: spotifyId, // Required for unique constraint
            external_ids: { spotify: spotifyId },
            metadata: {
                source: 'spotify_smart',
                artist: artistName,
                release_date: album.release_date,
                total_tracks: album.total_tracks,
                spotify_url: album.external_urls?.spotify,
                image_source: coverUrl.includes('theaudiodb') ? 'TheAudioDB' : 'Spotify'
            },
            cached_tags: validTags,

            // Core columns mapped 
            release_year: year,

            ...(embedding ? { vector_text: JSON.stringify(embedding) } : {})
        };

        const { error } = await supabase
            .from('global_items')
            .upsert(newItem, { onConflict: 'source,external_id' } as any);

        if (error) {
            console.error(`      ❌ DB Insert Error:`, error.message);
            // Debug Log to see what keys we are actually sending if it fails
            console.log('      DEBUG Payload Keys:', Object.keys(newItem));
        } else {
            console.log(`      ✅ Saved: "${albumTitle}"`);
            existingSpotifyIds.add(spotifyId);
        }

    } catch (err) {
        console.error(`      ❌ Error processing album:`, err);
    }
}

startHarvest().catch(console.error);
