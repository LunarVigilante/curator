#!/usr/bin/env npx tsx
/**
 * Content Harvest - Main Runner
 * 
 * Harvests content from multiple providers and seeds the database:
 * - TV Shows (TMDB)
 * - Anime (AniList)
 * - Board Games (BGG)
 * - Video Games (RAWG)
 * - Books (Google Books)
 * - Music (Spotify)
 * - Podcasts (iTunes)
 * 
 * Usage:
 *   npm run harvest:all           # Harvest all categories
 *   npm run harvest:all -- --only tv,anime  # Harvest specific categories
 *   npm run harvest:all -- --skip music     # Skip specific categories
 */

import 'dotenv/config';
import { createServiceRoleClient } from '../lib/supabase/service-role';
import {
    harvestTvShows,
    harvestAnime,
    harvestBoardGames,
    harvestVideoGames,
    harvestBooks,
    harvestMusic,
    harvestPodcasts,
    HarvestResult
} from '../lib/harvesters';
import { getLLMConfig } from '../lib/harvesters/shared';

// ============================================================================
// CONFIGURATION
// ============================================================================

type HarvesterName = 'tv' | 'anime' | 'boardgames' | 'videogames' | 'books' | 'music' | 'podcasts';

const HARVESTERS: Record<HarvesterName, {
    name: string;
    emoji: string;
    fn: (supabase: ReturnType<typeof createServiceRoleClient>) => Promise<HarvestResult>;
}> = {
    tv: { name: 'TV Shows', emoji: '📺', fn: harvestTvShows },
    anime: { name: 'Anime', emoji: '🎌', fn: harvestAnime },
    boardgames: { name: 'Board Games', emoji: '🎲', fn: harvestBoardGames },
    videogames: { name: 'Video Games', emoji: '🎮', fn: harvestVideoGames },
    books: { name: 'Books', emoji: '📚', fn: harvestBooks },
    music: { name: 'Music', emoji: '🎵', fn: harvestMusic },
    podcasts: { name: 'Podcasts', emoji: '🎙️', fn: harvestPodcasts },
};

// ============================================================================
// CLI PARSING
// ============================================================================

function parseArgs(): { only: HarvesterName[] | null; skip: HarvesterName[] } {
    const args = process.argv.slice(2);
    let only: HarvesterName[] | null = null;
    let skip: HarvesterName[] = [];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--only' && args[i + 1]) {
            only = args[i + 1].split(',').map(s => s.trim().toLowerCase()) as HarvesterName[];
            i++;
        } else if (args[i] === '--skip' && args[i + 1]) {
            skip = args[i + 1].split(',').map(s => s.trim().toLowerCase()) as HarvesterName[];
            i++;
        }
    }

    return { only, skip };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const startTime = Date.now();

    console.log('═'.repeat(70));
    console.log('🌾 CONTENT HARVEST - CURATOR DATABASE SEEDER');
    console.log('═'.repeat(70));
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log('');

    // Parse CLI args
    const { only, skip } = parseArgs();

    // Determine which harvesters to run
    let harvesterKeys = Object.keys(HARVESTERS) as HarvesterName[];

    if (only) {
        harvesterKeys = harvesterKeys.filter(k => only.includes(k));
        console.log(`🎯 Running only: ${only.join(', ')}`);
    }

    if (skip.length > 0) {
        harvesterKeys = harvesterKeys.filter(k => !skip.includes(k));
        console.log(`⏭️  Skipping: ${skip.join(', ')}`);
    }

    console.log(`📋 Categories to harvest: ${harvesterKeys.length}`);
    harvesterKeys.forEach(k => console.log(`   • ${HARVESTERS[k].emoji} ${HARVESTERS[k].name}`));
    console.log('');

    // Initialize
    const supabase = createServiceRoleClient();

    // Pre-load LLM config
    console.log('🔧 Loading LLM configuration...');
    try {
        const llmConfig = await getLLMConfig(supabase);
        console.log(`   • Provider: ${llmConfig.provider}`);
        console.log(`   • API Key: ${llmConfig.apiKey ? '✓ configured' : '✗ not configured'}`);
    } catch (e) {
        console.warn('   ⚠️ Could not load LLM config, descriptions will use originals');
    }
    console.log('');

    // Run harvesters
    const results: HarvestResult[] = [];

    for (const key of harvesterKeys) {
        const harvester = HARVESTERS[key];
        console.log('─'.repeat(70));

        try {
            const result = await harvester.fn(supabase);
            results.push(result);
        } catch (error) {
            console.error(`❌ ${harvester.name} harvester failed:`, error);
            results.push({ success: 0, skipped: 0, failed: 0, category: harvester.name });
        }
    }

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

    console.log('');
    console.log('═'.repeat(70));
    console.log('📊 HARVEST COMPLETE - SUMMARY');
    console.log('═'.repeat(70));
    console.log('');

    for (const result of results) {
        const harvester = Object.values(HARVESTERS).find(h => h.name === result.category);
        const emoji = harvester?.emoji || '📦';
        console.log(`   ${emoji} ${result.category.padEnd(15)} ${result.success.toString().padStart(4)} added | ${result.skipped.toString().padStart(4)} skipped | ${result.failed.toString().padStart(4)} failed`);
    }

    console.log('');
    console.log('─'.repeat(70));
    console.log(`   🏆 TOTAL:              ${totalSuccess.toString().padStart(4)} added | ${totalSkipped.toString().padStart(4)} skipped | ${totalFailed.toString().padStart(4)} failed`);
    console.log('─'.repeat(70));
    console.log(`   ⏱️  Time elapsed: ${elapsed} minutes`);
    console.log('═'.repeat(70));
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
