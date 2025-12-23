import { MediaStrategy, MediaResult } from "../types";

export class GoogleBooksStrategy implements MediaStrategy {
    name = "Google Books";
    description = "Search for books using Google Books API";

    async search(query: string, settings: Record<string, string>): Promise<MediaResult[]> {
        const apiKey = settings['google_books_api_key'];

        if (!apiKey) {
            console.warn("Google Books API key is missing");
            return [];
        }

        try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=5`);
            if (!response.ok) return [];

            const data = await response.json();
            if (!data.items) return [];

            return data.items.map((item: any) => {
                const info = item.volumeInfo;
                let imageUrl = info.imageLinks?.thumbnail;

                // HACK: Try to get a higher res image by changing zoom=1 to zoom=0 or 3
                if (imageUrl) {
                    imageUrl = imageUrl.replace('&zoom=1', '&zoom=3').replace('http:', 'https:');
                }

                const year = info.publishedDate ? info.publishedDate.substring(0, 4) : undefined;

                return {
                    id: item.id,
                    title: info.title,
                    description: info.description || '',
                    imageUrl: imageUrl,
                    year: year,
                    tags: info.categories || [],
                    metadata: {
                        authors: info.authors ? info.authors.join(', ') : undefined,
                        publisher: info.publisher,
                        pageCount: info.pageCount
                    }
                };
            });
        } catch (error) {
            console.error("Google Books search failed:", error);
            return [];
        }
    }
}
