import { MediaStrategy, MediaSearchResponse } from "../types";
import { SystemSettings } from '@/lib/services/SystemConfigService';

/**
 * Enhanced Google Books Strategy
 * 
 * IMPORTANT DATA QUALITY NOTES:
 * - Google Books is "Jack of all trades, master of none" - data quality varies wildly
 * - imageLinks are often tiny thumbnails (128px) - use high-res hack
 * - Series info is often hidden in title/description, not a dedicated field
 * 
 * Image Cascade Strategy:
 * 1. Try Google high-res hack (replace &zoom=1 with &zoom=0)
 * 2. Try Open Library Large cover (ISBN-L.jpg)
 * 3. Fallback to Google thumbnail
 */
export class GoogleBooksStrategy implements MediaStrategy {
    name = "Google Books";
    description = "Search for books using Google Books API with enhanced cover images and metadata";

    /**
     * Fetch detailed book info for enhanced metadata
     */
    private async fetchBookDetails(apiKey: string, volumeId: string, apiUrl: string): Promise<{
        description: string;
        categories: string[];
        pageCount: number;
        averageRating: number;
        ratingsCount: number;
        language: string;
        publisher: string;
        publishedDate: string;
        maturityRating: string;
        previewLink: string;
        infoLink: string;
    }> {
        try {
            const response = await fetch(`${apiUrl}/volumes/${volumeId}?key=${apiKey}`);

            if (!response.ok) {
                return this.getDefaultDetails();
            }

            const data = await response.json();
            const info = data.volumeInfo || {};

            return {
                description: info.description || '',
                categories: info.categories || [],
                pageCount: info.pageCount || 0,
                averageRating: info.averageRating || 0,
                ratingsCount: info.ratingsCount || 0,
                language: info.language || 'en',
                publisher: info.publisher || '',
                publishedDate: info.publishedDate || '',
                maturityRating: info.maturityRating || 'NOT_MATURE',
                previewLink: info.previewLink || '',
                infoLink: info.infoLink || ''
            };
        } catch (error) {
            console.error("Failed to fetch book details:", error);
            return this.getDefaultDetails();
        }
    }

    private getDefaultDetails() {
        return {
            description: '',
            categories: [],
            pageCount: 0,
            averageRating: 0,
            ratingsCount: 0,
            language: 'en',
            publisher: '',
            publishedDate: '',
            maturityRating: 'NOT_MATURE',
            previewLink: '',
            infoLink: ''
        };
    }

    /**
     * Get high-resolution book cover using cascade strategy
     * 1. Try Google high-res hack
     * 2. Try Open Library Large cover
     * 3. Fallback to Google thumbnail
     */
    private getBookCover(googleThumbnail: string | undefined, isbn: string | null): string | null {
        const coverUrls: string[] = [];

        // 1. Try Google High-Res Hack
        if (googleThumbnail) {
            // Remove edge curl and try larger zoom
            const highRes = googleThumbnail
                .replace('&edge=curl', '')
                .replace('&zoom=1', '&zoom=0')
                .replace('zoom=1', 'zoom=0');
            coverUrls.push(highRes);
        }

        // 2. Try Open Library LARGE cover (if ISBN exists)
        if (isbn) {
            coverUrls.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);
        }

        // 3. Fallback to Google thumbnail
        if (googleThumbnail) {
            coverUrls.push(googleThumbnail);
        }

        // Return first valid URL (we'll validate in the UI or on download)
        return coverUrls[0] || null;
    }

    /**
     * Extract ISBN from industry identifiers
     */
    private extractIsbn(identifiers: Array<{ type: string; identifier: string }> | undefined): {
        isbn13: string | null;
        isbn10: string | null;
        primary: string | null;
    } {
        if (!identifiers) {
            return { isbn13: null, isbn10: null, primary: null };
        }

        const isbn13Obj = identifiers.find(id => id.type === 'ISBN_13');
        const isbn10Obj = identifiers.find(id => id.type === 'ISBN_10');

        const isbn13 = isbn13Obj?.identifier || null;
        const isbn10 = isbn10Obj?.identifier || null;

        return {
            isbn13,
            isbn10,
            primary: isbn13 || isbn10 || null
        };
    }

    /**
     * Clean HTML description to plain text
     */
    private cleanDescription(html: string): string {
        return html
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<p>/gi, ' ')
            .replace(/<\/p>/gi, ' ')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Get book length category based on page count
     */
    private getLengthCategory(pageCount: number): string {
        if (pageCount === 0) return 'Unknown';
        if (pageCount < 100) return 'Short Story';
        if (pageCount < 200) return 'Novella';
        if (pageCount < 400) return 'Novel';
        if (pageCount < 600) return 'Long Novel';
        return 'Epic';
    }

    /**
     * Get publisher prestige category
     */
    private getPublisherCategory(publisher: string): string {
        const pubLower = publisher.toLowerCase();

        // Prestige publishers
        if (/penguin|vintage|knopf|random house|harpercollins|macmillan/.test(pubLower)) {
            return 'Major Publisher';
        }
        if (/penguin classics|everyman|oxford|cambridge|norton/.test(pubLower)) {
            return 'Classics/Academic';
        }
        if (/tor |orbit|del rey|baen|daw|ace books/.test(pubLower)) {
            return 'Genre (Sci-Fi/Fantasy)';
        }
        if (/harlequin|avon|kensington/.test(pubLower)) {
            return 'Genre (Romance)';
        }

        return publisher ? 'Independent' : 'Unknown';
    }

    async search(query: string, settings: SystemSettings): Promise<MediaSearchResponse> {
        const apiKey = settings['google_books_api_key'];
        const apiUrl = settings['google_books_api_url'] || 'https://www.googleapis.com/books/v1';

        if (!apiKey) {
            console.warn("Google Books API key is missing");
            return { success: false, data: [], error: "Missing Google Books API Key" };
        }

        try {
            const response = await fetch(`${apiUrl}/volumes?q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=5`);
            if (!response.ok) return { success: false, data: [], error: `Google Books Error: ${response.statusText}` };

            const data = await response.json();
            if (!data.items) return { success: true, data: [] };

            // Process books with enhanced metadata (parallel fetching)
            const resultsPromises = data.items.slice(0, 5).map(async (item: any) => {
                const info = item.volumeInfo || {};

                // Extract ISBN
                const isbn = this.extractIsbn(info.industryIdentifiers);

                // Get best cover image using cascade
                const imageUrl = this.getBookCover(info.imageLinks?.thumbnail, isbn.primary);

                // Fetch detailed book info
                const details = await this.fetchBookDetails(apiKey, item.id, apiUrl);

                // Clean description
                const cleanedDescription = this.cleanDescription(details.description || info.description || '');

                // Extract year
                const year = (details.publishedDate || info.publishedDate)?.substring(0, 4) || '';

                // Get author list
                const authors = info.authors || [];
                const authorsDisplay = authors.join(', ');

                // Get categories/genres
                const categories = details.categories.length > 0 ? details.categories : (info.categories || []);

                // Get length category
                const lengthCategory = this.getLengthCategory(details.pageCount);

                // Get publisher category
                const publisherCategory = this.getPublisherCategory(details.publisher);

                // Build description
                const descParts: string[] = [];
                if (authorsDisplay) descParts.push(`by ${authorsDisplay}`);
                if (categories.length > 0) descParts.push(categories[0]);
                if (details.pageCount) descParts.push(`${details.pageCount} pages`);
                if (details.averageRating) descParts.push(`★ ${details.averageRating.toFixed(1)}`);

                // Build AI analysis payload
                const analysisPayload = `Type: Book. Title: ${info.title}. Author: ${authorsDisplay || "Unknown"}. Genres: ${categories.join(", ") || "General"}. Page Count: ${details.pageCount}. Rating: ${details.averageRating || 'N/A'}. Publisher: ${details.publisher}. Language: ${details.language}. Description: ${cleanedDescription.substring(0, 500)}`;

                return {
                    id: `googlebooks-${item.id}`,
                    type: 'book',
                    title: info.title,
                    description: descParts.join(' • ') || cleanedDescription.substring(0, 150) || 'No description available',
                    imageUrl: imageUrl,
                    year: year,
                    tags: categories.slice(0, 5),
                    metadata: JSON.stringify({
                        googleBooksId: item.id,
                        type: 'book',
                        // Authors
                        authors: authorsDisplay,
                        authorsList: authors,
                        // ISBN (Critical for deduplication)
                        isbn13: isbn.isbn13,
                        isbn10: isbn.isbn10,
                        isbn: isbn.primary,
                        // Content
                        description: cleanedDescription,
                        categories: categories,
                        language: details.language,
                        // Size/Commitment
                        pageCount: details.pageCount,
                        lengthCategory: lengthCategory,
                        // Quality Signals
                        averageRating: details.averageRating,
                        ratingsCount: details.ratingsCount,
                        // Publisher Info
                        publisher: details.publisher,
                        publisherCategory: publisherCategory,
                        publishedDate: details.publishedDate,
                        // Content Rating
                        maturityRating: details.maturityRating,
                        // Links
                        previewLink: details.previewLink,
                        infoLink: details.infoLink,
                        // Cover URLs (for cascade fallback in UI)
                        coverUrls: {
                            googleHighRes: info.imageLinks?.thumbnail?.replace('&edge=curl', '').replace('&zoom=1', '&zoom=0'),
                            openLibrary: isbn.primary ? `https://covers.openlibrary.org/b/isbn/${isbn.primary}-L.jpg` : null,
                            googleThumbnail: info.imageLinks?.thumbnail
                        },
                        // AI Analysis Payload
                        analysisPayload: analysisPayload
                    })
                };
            });

            const results = await Promise.all(resultsPromises);

            return { success: true, data: results };
        } catch (error) {
            console.error("Google Books search failed:", error);
            return { success: false, data: [], error: "Google Books Unreachable" };
        }
    }
}
