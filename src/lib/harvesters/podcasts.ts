/**
 * Podcasts Harvester - iTunes Search API
 * Fetches top podcasts from iTunes charts
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding } from './shared';

const API_DELAY_MS = 300;
const LIMIT = 100;

// iTunes podcast genres for variety
const GENRES = [
    'Society \u0026 Culture',
    'True Crime',
    'Comedy',
    'News',
    'Business',
    'Health \u0026 Fitness',
    'Technology',
    'Arts',
    'Sports',
    'Science'
];

interface iTunesPodcast {
    trackId: number;
    trackName: string;
    artistName: string;
    artworkUrl600: string;
    releaseDate: string;
    genres: string[];
    trackCount: number;
    feedUrl: string;
    description?: string;
}

export async function harvestPodcasts(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎙️ HARVESTING PODCASTS (iTunes)...');

    const podcasts: iTunesPodcast[] = [];
    const podcastIds = new Set<number>();
    const resultsPerGenre = Math.ceil(LIMIT / GENRES.length);

    // Search for each genre
    for (const genre of GENRES) {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(genre)}&entity=podcast&limit=${resultsPerGenre}&country=US`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`iTunes error: ${response.status}`);
            const data = await response.json();

            for (const podcast of data.results || []) {
                if (!podcastIds.has(podcast.trackId)) {
                    podcastIds.add(podcast.trackId);
                    podcasts.push(podcast);
                }
            }
            await sleep(API_DELAY_MS);
        } catch (error) {
            console.error(`❌ iTunes fetch error (${genre}):`, error);
        }
    }

    // Also fetch top podcasts (empty term returns popular)
    try {
        const topUrl = 'https://itunes.apple.com/search?term=podcast&entity=podcast&limit=50&country=US';
        const response = await fetch(topUrl);
        if (response.ok) {
            const data = await response.json();
            for (const podcast of data.results || []) {
                if (!podcastIds.has(podcast.trackId)) {
                    podcastIds.add(podcast.trackId);
                    podcasts.push(podcast);
                }
            }
        }
    } catch {
        // Continue with what we have
    }

    const limitedPodcasts = podcasts.slice(0, LIMIT);
    console.log(`📊 Fetched ${limitedPodcasts.length} podcasts`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < limitedPodcasts.length; i++) {
        const podcast = limitedPodcasts[i];
        const originalDesc = `${podcast.trackName} by ${podcast.artistName}. A ${podcast.genres?.[0] || 'general'} podcast with ${podcast.trackCount || 'many'} episodes.`;

        // AI rewrite with limiter
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, podcast.trackName, originalDesc, 'Podcast')
        );

        // Generate embedding
        const embedding = await generateEmbedding(`${podcast.trackName}: ${description}`);

        const item: HarvestItem = {
            title: podcast.trackName,
            description,
            image_url: podcast.artworkUrl600 || null,
            category_type: 'PODCAST',
            external_ids: { itunes_podcast: podcast.trackId },
            metadata: {
                artist_name: podcast.artistName,
                genres: podcast.genres || [],
                track_count: podcast.trackCount,
                release_date: podcast.releaseDate,
                feed_url: podcast.feedUrl,
                source: 'itunes_harvest'
            },
            ...(embedding ? { embedding } : {})
        };

        const result = await upsertItem(supabase, item, 'itunes_podcast', podcast.trackId);
        if (result) success++;
        else failed++;

        if ((i + 1) % 25 === 0) {
            console.log(`   🎙️ Podcasts: ${i + 1}/${limitedPodcasts.length} (${success} added)`);
        }

        await sleep(100);
    }

    console.log(`✅ Podcasts: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Podcasts' };
}
