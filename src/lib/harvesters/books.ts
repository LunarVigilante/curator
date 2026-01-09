/**
 * Books Harvester - Google Books API (Massive Import)
 * Fetches books by iterating through popular subjects
 * Each subject: 10 pages × 40 books = 400 per subject
 * 8 subjects × 400 = ~3,200 books target
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding, generateTags, ensureTags } from './shared';

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
const API_DELAY_MS = 300;
const MAX_RESULTS_PER_REQUEST = 40;  // Google Books max
const MAX_START_INDEX = 400;         // Loop startIndex from 0 to 400

// Popular subjects to iterate through
const SUBJECTS = [
    'fiction',
    'fantasy',
    'mystery',
    'thriller',
    'science',
    'history',
    'romance',
    'horror',
    'biography',
    'self-help',
    'business',
    'philosophy'
];

interface GoogleBook {
    id: string;
    volumeInfo: {
        title: string;
        authors?: string[];
        description?: string;
        imageLinks?: { thumbnail?: string; smallThumbnail?: string };
        publishedDate?: string;
        averageRating?: number;
        ratingsCount?: number;
        categories?: string[];
        publisher?: string;
        pageCount?: number;
        language?: string;
    };
}

export async function harvestBooks(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n📚 HARVESTING BOOKS (Google Books - Deep Import)...');
    console.log(`   📋 Config: ${SUBJECTS.length} subjects × ${Math.ceil(MAX_START_INDEX / MAX_RESULTS_PER_REQUEST)} pages = ~${SUBJECTS.length * MAX_START_INDEX} books target`);

    if (!GOOGLE_BOOKS_API_KEY) {
        console.error('❌ GOOGLE_BOOKS_API_KEY not set');
        return { success: 0, skipped: 0, failed: 0, category: 'Books' };
    }

    const books: GoogleBook[] = [];
    const bookIds = new Set<string>();

    for (const subject of SUBJECTS) {
        console.log(`\n   📖 Fetching subject: ${subject}...`);

        for (let startIndex = 0; startIndex < MAX_START_INDEX; startIndex += MAX_RESULTS_PER_REQUEST) {
            const query = `subject:${subject}`;
            const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&startIndex=${startIndex}&maxResults=${MAX_RESULTS_PER_REQUEST}&orderBy=relevance&key=${GOOGLE_BOOKS_API_KEY}`;

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    if (response.status === 429) {
                        console.warn('   ⏳ Rate limited, waiting 30s...');
                        await sleep(30000);
                        startIndex -= MAX_RESULTS_PER_REQUEST;  // Retry
                        continue;
                    }
                    throw new Error(`Google Books error: ${response.status}`);
                }

                const data = await response.json();
                const items = data.items || [];

                for (const book of items) {
                    if (!bookIds.has(book.id) && book.volumeInfo?.title) {
                        bookIds.add(book.id);
                        books.push(book);
                    }
                }

                // Stop early if no more results
                if (items.length < MAX_RESULTS_PER_REQUEST) {
                    break;
                }

                await sleep(API_DELAY_MS);
            } catch (error) {
                console.error(`   ❌ Google Books fetch error (${subject} @ ${startIndex}):`, error);
                // Continue to next batch
            }
        }

        console.log(`   📚 ${subject}: ${books.length} total unique books so far`);
    }

    console.log(`\n📊 Fetched ${books.length} unique books`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < books.length; i++) {
        const book = books[i];
        const vol = book.volumeInfo;

        if (!vol.title) {
            skipped++;
            continue;
        }

        const originalDesc = vol.description || '';

        try {
            // AI rewrite with limiter
            const description = await aiLimiter(() =>
                rewriteDescription(supabase, vol.title, originalDesc, 'Book')
            );

            // Generate tags
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, vol.title, description, 'Book')
            );
            const validTags = await ensureTags(supabase, tagNames);

            // Generate embedding
            const embedding = await generateEmbedding(`${vol.title}: ${description}`);

            const item: HarvestItem = {
                title: vol.title,
                description,
                image_url: vol.imageLinks?.thumbnail?.replace('http:', 'https:') ||
                    vol.imageLinks?.smallThumbnail?.replace('http:', 'https:') || null,
                category_type: 'BOOK',
                external_ids: { google_books: book.id },
                metadata: {
                    authors: vol.authors || [],
                    published_date: vol.publishedDate,
                    rating: vol.averageRating,
                    ratings_count: vol.ratingsCount,
                    categories: vol.categories || [],
                    publisher: vol.publisher,
                    page_count: vol.pageCount,
                    language: vol.language,
                    source: 'google_books_harvest',
                    original_description: originalDesc
                },
                cached_tags: validTags,
                ...(embedding ? { embedding } : {})
            };

            const result = await upsertItem(supabase, item, 'google_books', book.id);
            if (result) success++;
            else failed++;
        } catch (error) {
            console.error(`   ❌ Failed to process "${vol.title}":`, error);
            failed++;
        }

        if ((i + 1) % 100 === 0) {
            console.log(`   📚 Books: ${i + 1}/${books.length} (${success} added, ${failed} failed)`);
        }

        await sleep(50);
    }

    console.log(`✅ Books: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Books' };
}
