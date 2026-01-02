
import { GoogleBooksStrategy } from '../lib/services/media/strategies/GoogleBooksStrategy';
import { SystemConfigService } from '../lib/services/SystemConfigService';
import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
    console.log("Testing Google Books Strategy...");
    const strategy = new GoogleBooksStrategy();
    // const settings = await SystemConfigService.getSettings();

    // Mock settings if DB fetch fails or just rely on env
    const mockSettings = {
        'google_books_api_key': process.env.GOOGLE_BOOKS_API_KEY || '',
        'google_books_api_url': 'https://www.googleapis.com/books/v1'
    };

    if (!mockSettings.google_books_api_key) {
        console.error("Missing GOOGLE_BOOKS_API_KEY in .env");
        return;
    }

    const query = "We Are Legion (We Are Bob)";
    console.log(`Searching for: ${query}`);

    const result = await strategy.search(query, mockSettings as any);

    if (result.success && result.data && result.data.length > 0) {
        const first = result.data[0];
        console.log("--- First Result ---");
        console.log("Title:", first.title);
        console.log("Tags (Direct):", first.tags);
        console.log("Metadata:", first.metadata); // This is a string

        try {
            const meta = JSON.parse(first.metadata as string);
            console.log("Parsed Metadata Categories:", meta.categories);
        } catch (e) {
            console.error("Failed to parse metadata JSON", e);
        }
    } else {
        console.log("No results found or error:", result.error);
    }
}

test().catch(console.error);
