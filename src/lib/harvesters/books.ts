/**
 * Books Harvester - Google Books API
 * Fetches popular/bestselling books from Google Books
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding } from './shared';

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
const API_DELAY_MS = 300;
const LIMIT = 100;

// Diverse queries to get variety
const SEARCH_QUERIES = [
    'subject:fiction bestseller',
    'subject:science fiction award',
    'subject:fantasy epic',
    'subject:mystery thriller',
    'subject:biography',
    'subject:history',
    'subject:romance bestseller',
    'subject:horror classic'
];

interface GoogleBook {
    id: string;
    volumeInfo: {
        title: string;
        authors?: string[];
        description?: string;
        imageLinks?: { thumbnail?: string };
        publishedDate?: string;
        averageRating?: number;
        categories?: string[];
        publisher?: string;
    };
}

export async function harvestBooks(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n📚 HARVESTING BOOKS (Google Books)...');

    if (!GOOGLE_BOOKS_API_KEY) {
        console.error('❌ GOOGLE_BOOKS_API_KEY not set');
        return { success: 0, skipped: 0, failed: 0, category: 'Books' };
    }

    const books: GoogleBook[] = [];
    const resultsPerQuery = Math.ceil(LIMIT / SEARCH_QUERIES.length);

    // Fetch from each query
    for (const query of SEARCH_QUERIES) {
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${resultsPerQuery}&orderBy=relevance&key=${GOOGLE_BOOKS_API_KEY}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Google Books error: ${response.status}`);
            const data = await response.json();
            books.push(...(data.items || []));
            await sleep(API_DELAY_MS);
        } catch (error) {
            console.error(`❌ Google Books fetch error (${query}):`, error);
        }
    }

    // Dedupe by ID
    const bookMap = new Map<string, GoogleBook>();
    books.forEach(b => bookMap.set(b.id, b));
    const uniqueBooks = Array.from(bookMap.values()).slice(0, LIMIT);

    console.log(`📊 Fetched ${uniqueBooks.length} books`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < uniqueBooks.length; i++) {
        const book = uniqueBooks[i];
        const vol = book.volumeInfo;
        const originalDesc = vol.description || '';

        if (!vol.title) continue;

        // AI rewrite with limiter
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, vol.title, originalDesc, 'Book')
        );

        // Generate embedding
        const embedding = await generateEmbedding(`${vol.title}: ${description}`);

        const item: HarvestItem = {
            title: vol.title,
            description,
            image_url: vol.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
            category_type: 'BOOK',
            external_ids: { google_books: book.id },
            metadata: {
                authors: vol.authors || [],
                published_date: vol.publishedDate,
                rating: vol.averageRating,
                categories: vol.categories || [],
                publisher: vol.publisher,
                source: 'google_books_harvest',
                original_description: originalDesc
            },
            ...(embedding ? { embedding } : {})
        };

        const result = await upsertItem(supabase, item, 'google_books', book.id);
        if (result) success++;
        else failed++;

        if ((i + 1) % 25 === 0) {
            console.log(`   📚 Books: ${i + 1}/${uniqueBooks.length} (${success} added)`);
        }

        await sleep(100);
    }

    console.log(`✅ Books: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Books' };
}
