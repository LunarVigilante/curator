#!/usr/bin/env npx tsx
/**
 * TMDB Harvester CLI
 * 
 * Unified script for harvesting Movies and TV Shows from TMDB.
 * 
 * Usage:
 *   npx tsx src/scripts/harvest-tmdb.ts --type=movie --operation=harvest
 *   npx tsx src/scripts/harvest-tmdb.ts --type=tv --operation=harvest --startYear=2025 --endYear=2020
 *   npx tsx src/scripts/harvest-tmdb.ts --type=movie --operation=backfill --limit=500
 *   npx tsx src/scripts/harvest-tmdb.ts --type=tv --operation=backfill
 *   npx tsx src/scripts/harvest-tmdb.ts --type=tv --operation=backfill --dryRun
 */

import 'dotenv/config';
import { createServiceRoleClient } from '../lib/supabase/service-role';
import { harvestTmdb, type TmdbHarvestOptions } from '../lib/harvesters/tmdb';

// ============================================================================
// CLI PARSING
// ============================================================================

function parseArgs(): TmdbHarvestOptions {
    const args = process.argv.slice(2);

    const getArg = (name: string): string | undefined => {
        const arg = args.find(a => a.startsWith(`--${name}=`));
        return arg?.split('=')[1];
    };

    const hasFlag = (name: string): boolean => {
        return args.includes(`--${name}`);
    };

    const type = getArg('type') as 'movie' | 'tv' | undefined;
    const operation = getArg('operation') as 'harvest' | 'backfill' | undefined;

    if (!type || !['movie', 'tv'].includes(type)) {
        console.error('❌ Missing or invalid --type. Use --type=movie or --type=tv');
        process.exit(1);
    }

    if (!operation || !['harvest', 'backfill'].includes(operation)) {
        console.error('❌ Missing or invalid --operation. Use --operation=harvest or --operation=backfill');
        process.exit(1);
    }

    return {
        type,
        operation,
        startYear: getArg('startYear') ? parseInt(getArg('startYear')!, 10) : undefined,
        endYear: getArg('endYear') ? parseInt(getArg('endYear')!, 10) : undefined,
        maxPages: getArg('maxPages') ? parseInt(getArg('maxPages')!, 10) : undefined,
        limit: getArg('limit') ? parseInt(getArg('limit')!, 10) : undefined,
        dryRun: hasFlag('dryRun'),
    };
}

function printUsage() {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         TMDB HARVESTER CLI                                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ REQUIRED FLAGS:                                                              ║
║   --type=movie|tv          Media type to process                             ║
║   --operation=harvest|backfill                                               ║
║                                                                              ║
║ HARVEST OPTIONS (discover new items):                                        ║
║   --startYear=YYYY         Start year (default: current year)                ║
║   --endYear=YYYY           End year (default: 1970)                          ║
║   --maxPages=N             Max pages per year (default: 100)                 ║
║                                                                              ║
║ BACKFILL OPTIONS (update existing items):                                    ║
║   --limit=N                Max items to process (default: 1000)              ║
║   --dryRun                 Preview without writing to database               ║
║                                                                              ║
║ EXAMPLES:                                                                    ║
║   # Harvest all new movies from 2025 to 2020                                 ║
║   npx tsx src/scripts/harvest-tmdb.ts --type=movie --operation=harvest \\     ║
║       --startYear=2025 --endYear=2020                                        ║
║                                                                              ║
║   # Backfill missing TV show metadata (including 'type' field)               ║
║   npx tsx src/scripts/harvest-tmdb.ts --type=tv --operation=backfill         ║
║                                                                              ║
║   # Dry run to preview what would be updated                                 ║
║   npx tsx src/scripts/harvest-tmdb.ts --type=tv --operation=backfill \\       ║
║       --limit=50 --dryRun                                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const startTime = Date.now();

    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    const options = parseArgs();

    console.log('═'.repeat(70));
    console.log('🎬 TMDB HARVESTER');
    console.log('═'.repeat(70));
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log(`🎯 Type: ${options.type.toUpperCase()}`);
    console.log(`⚙️  Operation: ${options.operation.toUpperCase()}`);
    if (options.dryRun) console.log(`🏃 Mode: DRY RUN`);
    console.log('');

    const supabase = createServiceRoleClient();

    try {
        const result = await harvestTmdb(supabase, options);

        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        console.log('');
        console.log('═'.repeat(70));
        console.log('📊 COMPLETE');
        console.log('═'.repeat(70));
        console.log(`   ✅ Success: ${result.success}`);
        console.log(`   ⏭️  Skipped: ${result.skipped}`);
        console.log(`   ❌ Failed: ${result.failed}`);
        console.log(`   ⏱️  Time: ${elapsed} minutes`);
        console.log('═'.repeat(70));

    } catch (error) {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    }
}

main();
