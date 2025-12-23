import { MediaStrategy, MediaResult } from "./types";
import { JikanStrategy } from "./strategies/JikanStrategy";
import { TmdbStrategy } from "./strategies/TmdbStrategy";
import { RawgStrategy } from "./strategies/RawgStrategy";
import { LastfmStrategy } from "./strategies/LastfmStrategy";
import { GoogleBooksStrategy } from "./strategies/GoogleBooksStrategy";
import { ItunesPodcastStrategy } from "./strategies/ItunesPodcastStrategy";

export class MediaService {
    private strategies: MediaStrategy[] = [
        new JikanStrategy(),
        new TmdbStrategy(),
        new RawgStrategy(),
        new LastfmStrategy(),
        new GoogleBooksStrategy(),
        new ItunesPodcastStrategy()
    ];

    private getStrategy(categoryName: string): MediaStrategy | null {
        const lowerCat = categoryName.toLowerCase();

        if (lowerCat.includes('anime') || lowerCat.includes('manga')) {
            return this.strategies.find(s => s instanceof JikanStrategy) || null;
        }
        if (lowerCat.includes('movie') || lowerCat.includes('tv') || lowerCat.includes('show') || lowerCat.includes('film')) {
            return this.strategies.find(s => s instanceof TmdbStrategy) || null;
        }
        if (lowerCat.includes('game') || lowerCat.includes('rpg') || lowerCat.includes('playstation') || lowerCat.includes('nintendo') || lowerCat.includes('xbox')) {
            return this.strategies.find(s => s instanceof RawgStrategy) || null;
        }
        if (lowerCat.includes('music') || lowerCat.includes('album') || lowerCat.includes('song') || lowerCat.includes('artist')) {
            return this.strategies.find(s => s instanceof LastfmStrategy) || null;
        }
        if (lowerCat.includes('book') || lowerCat.includes('novel') || lowerCat.includes('literature') || lowerCat.includes('reading')) {
            return this.strategies.find(s => s instanceof GoogleBooksStrategy) || null;
        }
        if (lowerCat.includes('podcast') || lowerCat.includes('audio') || lowerCat.includes('listen')) {
            return this.strategies.find(s => s instanceof ItunesPodcastStrategy) || null;
        }

        return null;
    }

    async search(query: string, categoryName: string, settings: Record<string, string>): Promise<MediaResult[]> {
        const strategy = this.getStrategy(categoryName);

        if (!strategy) {
            console.log(`No media strategy found for category: ${categoryName}`);
            return [];
        }

        console.log(`Using strategy: ${strategy.name} for category: ${categoryName}`);
        return await strategy.search(query, settings);
    }
}
