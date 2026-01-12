/**
 * Podcasts Harvester - iTunes Search API (Massive Import)
 * Fetches podcasts by iterating through genre IDs
 * Each genre: fetch top 200
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, upsertItem, generateEmbedding, generateTags, ensureTags } from './shared';
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description';

const API_DELAY_MS = 500;  // iTunes is fairly generous but be respectful

// iTunes Podcast Genre IDs
// https://affiliate.itunes.apple.com/resources/documentation/genre-mapping/
const GENRE_IDS = [
    { id: 1301, name: 'Arts' },
    { id: 1303, name: 'Comedy' },
    { id: 1304, name: 'Education' },
    { id: 1305, name: 'Kids & Family' },
    { id: 1307, name: 'Health & Fitness' },
    { id: 1309, name: 'TV & Film' },
    { id: 1310, name: 'Music' },
    { id: 1311, name: 'News' },
    { id: 1314, name: 'Religion & Spirituality' },
    { id: 1315, name: 'Science' },
    { id: 1316, name: 'Sports' },
    { id: 1318, name: 'Technology' },
    { id: 1321, name: 'Business' },
    { id: 1324, name: 'Society & Culture' },
    { id: 1325, name: 'True Crime' },
    { id: 1488, name: 'History' },
    { id: 1489, name: 'Leisure' },
    { id: 1543, name: 'Fiction' },
    { id: 1544, name: 'Government' },
];

// Additional search terms for more coverage
const SEARCH_TERMS = [
    'top podcasts',
    'best podcasts 2024',
    'popular podcasts',
    'new podcasts',
    'trending podcasts',
    'award winning podcast',
    'interview podcast',
    'storytelling podcast',
    'documentary podcast',
    'investigative podcast',
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
    collectionExplicitness: string;
    primaryGenreName: string;
}

async function fetchPodcastsByGenre(genreId: number): Promise<iTunesPodcast[]> {
    // iTunes doesn't have a direct genre filter, so we use search with genre term
    const genre = GENRE_IDS.find(g => g.id === genreId);
    if (!genre) return [];

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(genre.name + ' podcast')}&entity=podcast&limit=200&country=US`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`iTunes error: ${response.status}`);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error(`   ❌ iTunes fetch error (genre ${genre.name}):`, error);
        return [];
    }
}

async function fetchPodcastsByTerm(term: string): Promise<iTunesPodcast[]> {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=podcast&limit=200&country=US`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`iTunes error: ${response.status}`);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error(`   ❌ iTunes fetch error (term "${term}"):`, error);
        return [];
    }
}

export async function harvestPodcasts(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎙️ HARVESTING PODCASTS (iTunes - Deep Import)...');
    console.log(`   📋 Config: ${GENRE_IDS.length} genres + ${SEARCH_TERMS.length} search terms`);

    const podcasts: iTunesPodcast[] = [];
    const podcastIds = new Set<number>();

    // Fetch by genre
    console.log('\n   📂 Fetching podcasts by genre...');
    for (let i = 0; i < GENRE_IDS.length; i++) {
        const genre = GENRE_IDS[i];
        const results = await fetchPodcastsByGenre(genre.id);

        for (const podcast of results) {
            if (!podcastIds.has(podcast.trackId)) {
                podcastIds.add(podcast.trackId);
                podcasts.push(podcast);
            }
        }

        console.log(`   🎙️ Genre ${i + 1}/${GENRE_IDS.length} (${genre.name}): ${podcasts.length} unique total`);
        await sleep(API_DELAY_MS);
    }

    // Fetch by search terms
    console.log('\n   🔍 Fetching podcasts by search terms...');
    for (const term of SEARCH_TERMS) {
        const results = await fetchPodcastsByTerm(term);

        for (const podcast of results) {
            if (!podcastIds.has(podcast.trackId)) {
                podcastIds.add(podcast.trackId);
                podcasts.push(podcast);
            }
        }
        await sleep(API_DELAY_MS);
    }

    // Also fetch "top" podcasts with empty query
    try {
        const topUrl = 'https://itunes.apple.com/search?term=podcast&entity=podcast&limit=200&country=US';
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
        // Continue
    }

    console.log(`\n📊 Fetched ${podcasts.length} unique podcasts`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < podcasts.length; i++) {
        const podcast = podcasts[i];

        if (!podcast.trackName) {
            skipped++;
            continue;
        }

        try {
            const originalDesc = `${podcast.trackName} by ${podcast.artistName}. A ${podcast.primaryGenreName || podcast.genres?.[0] || 'general'} podcast with ${podcast.trackCount || 'many'} episodes.`;

            // Generate 4-part structured description (parallel LLM calls)
            const description_parts = await aiLimiter(() =>
                generateStructuredDescription(supabase, {
                    title: podcast.trackName,
                    originalDescription: originalDesc,
                    type: 'Podcast',
                    metadata: { genres: podcast.genres, artist: podcast.artistName }
                })
            );

            // Combine for backwards compatibility
            const description = combineDescription(description_parts);

            // Generate tags
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, podcast.trackName, description, 'Podcast')
            );
            const validTags = await ensureTags(supabase, tagNames);

            const item: HarvestItem = {
                title: podcast.trackName,
                description,
                description_parts,
                image_url: podcast.artworkUrl600 || null,
                category_type: 'PODCAST',
                external_ids: { itunes_podcast: podcast.trackId },
                genres: podcast.genres,
                metadata: {
                    artist_name: podcast.artistName,
                    genres: podcast.genres || [],
                    primary_genre: podcast.primaryGenreName,
                    track_count: podcast.trackCount,
                    release_date: podcast.releaseDate,
                    feed_url: podcast.feedUrl,
                    explicit: podcast.collectionExplicitness,
                    source: 'itunes_harvest'
                },
                cached_tags: validTags
            };

            // Generate rich embedding from all item data
            const embeddingText = buildEmbeddingText(item);
            const embedding = await generateEmbedding(embeddingText);
            if (embedding) {
                item.embedding = embedding;
            }

            const result = await upsertItem(supabase, item, 'itunes_podcast', podcast.trackId);
            if (result) success++;
            else failed++;
        } catch (error) {
            console.error(`   ❌ Failed to process "${podcast.trackName}":`, error);
            failed++;
        }

        if ((i + 1) % 100 === 0) {
            console.log(`   🎙️ Podcasts: ${i + 1}/${podcasts.length} (${success} added, ${failed} failed)`);
        }

        await sleep(50);
    }

    console.log(`✅ Podcasts: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Podcasts' };
}
