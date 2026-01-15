
import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { generateEmbedding, generateTags, ensureTags, sleep, aiLimiter, decodeHTMLEntities } from '@/lib/harvesters/shared';
// @ts-ignore
import pLimit from 'p-limit';

// ============================================================================
// CONFIG
// ============================================================================
const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const MAX_RESULTS = 40; // Google API Limit
const SUBJECTS = [
    // Fiction Genres
    'Science Fiction', 'Fantasy', 'Mystery', 'Thriller', 'Romance', 'Horror',
    'Adventure', 'Historical Fiction', 'Literary Fiction', 'Young Adult',
    // Non-Fiction
    'History', 'Science', 'Philosophy', 'Business', 'Self-Help', 'Biography',
    'Psychology', 'Art', 'Cooking', 'Travel', 'Poetry', 'True Crime',
    'Politics', 'Economics', 'Technology', 'Health', 'Religion', 'Memoir',
    // Specialty
    'Classics', 'Essays'
];
const CONCURRENCY = 1;

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers'); // using the 'covers' bucket
const limit = pLimit(CONCURRENCY);

// ============================================================================
// HELPER: CLEAN COVER URL
// ============================================================================
function getCleanCoverUrl(url: string): string {
    if (!url) return '';

    // Remove edge curl
    let clean = url.replace('&edge=curl', '');

    // Attempt to upgrade zoom
    // Standard thumbnails are often zoom=1. We can try zoom=2 or zoom=3 or fife=w800
    if (clean.includes('zoom=1')) {
        clean = clean.replace('zoom=1', 'zoom=3');
    } else if (clean.includes('zoom=2')) {
        // keep zoom=2 or upgrade? Let's try to maintain highest possible
        // Often removing zoom param entirely yields a decent size or fife parameter work
    }

    // Google images often work better if we verify protocol
    if (clean.startsWith('http://')) {
        clean = clean.replace('http://', 'https://');
    }

    return clean;
}

// ============================================================================
// HELPER: PARSE DATE - Ensures proper YYYY-MM-DD format
// ============================================================================
function parsePublishedDate(dateStr: string | undefined): { year: number | null, fullDate: string | null } {
    if (!dateStr) return { year: null, fullDate: null };

    // Try to parse the date string
    // Formats: "2013", "2013-05", "2013-05-15"
    const parts = dateStr.split('-');

    if (parts.length === 1 && parts[0].length === 4) {
        // Just year: "2013" -> "2013-01-01"
        const year = parseInt(parts[0]);
        return { year, fullDate: `${parts[0]}-01-01` };
    } else if (parts.length === 2) {
        // Year and month: "2013-05" -> "2013-05-01"
        const year = parseInt(parts[0]);
        return { year, fullDate: `${parts[0]}-${parts[1]}-01` };
    } else if (parts.length === 3) {
        // Full date: "2013-05-15"
        const year = parseInt(parts[0]);
        return { year, fullDate: dateStr };
    }

    return { year: null, fullDate: null };
}

// ============================================================================
// MAIN HARVESTER
// ============================================================================
async function harvestBooks() {
    console.log(`📚 STARTING BOOK HARVEST`);
    console.log(`   Subjects: ${SUBJECTS.length} categories`);

    for (const subject of SUBJECTS) {
        console.log(`\n🔎 Harvesting Subject: ${subject}`);

        let startIndex = 0;
        let hasMore = true;
        // Harvest top 200 books per subject (5 pages of 40)
        const MAX_PER_SUBJECT = 200;

        while (hasMore && startIndex < MAX_PER_SUBJECT) {
            try {
                const url = `${GOOGLE_BOOKS_API}?q=subject:${encodeURIComponent(subject)}&langRestrict=en&maxResults=${MAX_RESULTS}&startIndex=${startIndex}&printType=books&orderBy=relevance`;

                const res = await fetch(url);

                if (res.status === 429) {
                    console.log('   ⏳ Rate limit hit. Sleeping 10s...');
                    await sleep(10000);
                    continue;
                }

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                if (!data.items || data.items.length === 0) {
                    hasMore = false;
                    break;
                }

                console.log(`   Processing batch ${startIndex} - ${startIndex + data.items.length}...`);

                // Process batch concurrently with limit
                await Promise.all(data.items.map((item: any) => limit(() => processBook(item, subject))));

                startIndex += MAX_RESULTS;
                await sleep(1000); // Be rate-limit friendly

            } catch (err: any) {
                console.error(`❌ Error fetching subject ${subject}:`, err.message);
                hasMore = false;
            }
        }
    }
}

async function processBook(item: any, harvestSubject: string) {
    const info = item.volumeInfo;
    if (!info) return;

    // Filter minimum requirements
    if (!info.title || !info.description || !info.imageLinks?.thumbnail) {
        // console.log(`      Skipping ${info.title?.substring(0, 20)}... (Missing metadata)`);
        return;
    }

    const title = decodeHTMLEntities(info.title);

    // Deduplication check
    // Prefer ISBN-13
    let isbn = info.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier;
    if (!isbn) isbn = info.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')?.identifier;

    // First check by Google ID
    const { data: existingGoogle } = await supabase
        .from('global_items')
        .select('id')
        .contains('external_ids', { google: item.id })
        .maybeSingle();

    if (existingGoogle) return; // Already exists

    // Then check by ISBN if available
    if (isbn) {
        const { data: existingIsbn } = await supabase
            .from('global_items')
            .select('id')
            .contains('metadata', { isbn: isbn }) // Assuming we store isbn in metadata
            .maybeSingle();

        if (existingIsbn) return;
    }

    // Process Cover
    const cleanCoverUrl = getCleanCoverUrl(info.imageLinks.thumbnail);
    // Use processAndUpload with 'book' prefix
    const hostedCoverUrl = await imageService.processAndUpload(cleanCoverUrl, 'book');

    if (!hostedCoverUrl) {
        console.log(`      ⚠️ Failed to upload cover for ${title}`);
        return;
    }

    // Process Description & Embeddings
    const cleanDesc = decodeHTMLEntities(info.description);
    const { year, fullDate } = parsePublishedDate(info.publishedDate);

    // Tags
    // Combine explicit categories + author + subject
    const rawCategories = info.categories || [];
    const contextStr = `${harvestSubject} ${rawCategories.join(' ')} ${info.authors?.join(' ')}`.trim();
    const tags = await aiLimiter(() => generateTags(supabase, title, `${cleanDesc} ${contextStr}`, 'BOOK'));
    const validTags = await ensureTags(supabase, tags);

    // Vector Embedding
    const vectorText = `
        Title: ${title}
        Author: ${info.authors?.join(', ')}
        Subject: ${harvestSubject}
        Description: ${cleanDesc}
    `.trim();

    const embedding = await generateEmbedding(vectorText);

    // Payload
    const payload = {
        title: title,
        category_type: 'BOOK', // Unified type
        description: cleanDesc,
        image_url: hostedCoverUrl,
        release_year: year || undefined,
        release_date: fullDate || undefined, // Now properly formatted as YYYY-MM-DD
        genres: rawCategories.concat([harvestSubject]), // combine API categories + search subject

        external_ids: {
            google: item.id,
            isbn: isbn
        },

        metadata: {
            source: 'google_books_smart',
            authors: info.authors,
            publisher: info.publisher,
            page_count: info.pageCount,
            language: info.language,
            average_rating: info.averageRating,
            ratings_count: info.ratingsCount,
            harvest_subject: harvestSubject,
            isbn: isbn
        },

        cached_tags: validTags,
        vector_text: JSON.stringify(embedding),
        last_metadata_update: new Date().toISOString()
    };

    // Insert
    const { error } = await (supabase.from('global_items') as any).insert(payload);

    if (error) {
        console.error(`      ❌ Error inserting ${title}:`, error.message);
    } else {
        console.log(`      📚 Saved: ${title.substring(0, 40)}${title.length > 40 ? '...' : ''} (${year})`);
    }
}

// Start
harvestBooks().catch(console.error);
