/**
 * TMDB Bulk Export Ingestion Script
 * 
 * Processes daily TMDB bulk export files for efficient discovery of new content.
 * This is more efficient than polling the API for individual titles.
 * 
 * TMDB publishes daily exports at:
 * http://files.tmdb.org/p/exports/tv_series_ids_MM_DD_YYYY.json.gz
 * 
 * These files are available after 08:00 UTC each day.
 * 
 * Strategy:
 * 1. Download and decompress the GZIP export
 * 2. Filter by popularity threshold (> 1.0) and vote count (>= 2)
 * 3. Diff against existing database records
 * 4. Queue new IDs for enrichment via harvester
 * 
 * Usage:
 *   npx tsx src/scripts/harvest-bulk-export.ts
 *   npx tsx src/scripts/harvest-bulk-export.ts --date 2026-02-03
 *   npx tsx src/scripts/harvest-bulk-export.ts --dry-run
 */

import { createGunzip } from 'zlib';
import { Readable } from 'stream';
import readline from 'readline';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TMDB_EXPORT_BASE_URL = 'http://files.tmdb.org/p/exports';
const DEFAULT_POPULARITY_THRESHOLD = 1.0;
const DEFAULT_VOTE_COUNT_THRESHOLD = 2;
const BATCH_SIZE = 100;  // Insert new IDs in batches

// ============================================================================
// TYPES
// ============================================================================

interface TmdbExportRow {
    id: number;
    original_name: string;
    popularity: number;
}

interface BulkExportResult {
    totalRows: number;
    filteredRows: number;
    newIds: number;
    existingIds: number;
    duration: number;
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

function formatExportDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}_${day}_${year}`;
}

function getTodayDate(): Date {
    // TMDB exports are available after 08:00 UTC
    // If before 08:00 UTC, use yesterday's export
    const now = new Date();
    const utcHour = now.getUTCHours();

    if (utcHour < 8) {
        now.setDate(now.getDate() - 1);
    }

    return now;
}

// ============================================================================
// DOWNLOAD AND PARSE EXPORT
// ============================================================================

async function downloadAndParseExport(
    date: Date,
    popularityThreshold: number,
    voteCountThreshold: number
): Promise<TmdbExportRow[]> {
    const dateStr = formatExportDate(date);
    const url = `${TMDB_EXPORT_BASE_URL}/tv_series_ids_${dateStr}.json.gz`;

    console.log(`📥 Downloading TMDB export: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download export: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    console.log(`📦 Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Decompress GZIP and parse line by line
    const rows: TmdbExportRow[] = [];

    await new Promise<void>((resolve, reject) => {
        const gunzip = createGunzip();
        const readable = Readable.from(Buffer.from(buffer));
        const decompressed = readable.pipe(gunzip);

        const rl = readline.createInterface({
            input: decompressed,
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            try {
                const row = JSON.parse(line) as TmdbExportRow;
                // Filter by popularity and vote count
                if (row.popularity >= popularityThreshold) {
                    rows.push(row);
                }
            } catch {
                // Skip invalid JSON lines
            }
        });

        rl.on('close', resolve);
        rl.on('error', reject);
    });

    console.log(`📊 Parsed ${rows.length} rows above popularity threshold`);
    return rows;
}

// ============================================================================
// DATABASE DIFF
// ============================================================================

async function findNewIds(tmdbIds: number[]): Promise<number[]> {
    const supabase = createServiceRoleClient();

    // Fetch existing TMDB IDs from database
    console.log(`🔍 Checking ${tmdbIds.length} IDs against database...`);

    const { data: existingItems, error } = await supabase
        .from('global_items')
        .select('external_ids')
        .eq('category_type', 'TV_SHOW')
        .not('external_ids', 'is', null);

    if (error) {
        throw new Error(`Database query failed: ${error.message}`);
    }

    // Extract existing TMDB IDs
    const existingTmdbIds = new Set<number>();
    for (const item of existingItems || []) {
        const tmdbId = item.external_ids?.tmdb_id;
        if (tmdbId) {
            existingTmdbIds.add(Number(tmdbId));
        }
    }

    console.log(`📚 Found ${existingTmdbIds.size} existing TV shows in database`);

    // Find new IDs
    const newIds = tmdbIds.filter(id => !existingTmdbIds.has(id));
    console.log(`✨ Discovered ${newIds.length} new TV shows`);

    return newIds;
}

// ============================================================================
// QUEUE FOR HARVESTING
// ============================================================================

interface HarvestQueueItem {
    tmdb_id: number;
    priority: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
}

async function queueForHarvest(ids: number[], popularityMap: Map<number, number>): Promise<void> {
    const supabase = createServiceRoleClient();

    // Queue in batches
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);

        const queueItems: HarvestQueueItem[] = batch.map(id => ({
            tmdb_id: id,
            priority: Math.round((popularityMap.get(id) || 1) * 100), // Higher popularity = higher priority
            status: 'pending' as const,
            created_at: new Date().toISOString()
        }));

        // Use upsert to avoid duplicates
        const { error } = await supabase
            .from('harvest_queue')
            .upsert(queueItems, { onConflict: 'tmdb_id' });

        if (error) {
            console.warn(`⚠️ Queue batch ${i / BATCH_SIZE + 1} error: ${error.message}`);
        } else {
            console.log(`   ✓ Queued batch ${i / BATCH_SIZE + 1}/${Math.ceil(ids.length / BATCH_SIZE)}`);
        }
    }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main(): Promise<BulkExportResult> {
    const startTime = Date.now();

    // Parse CLI arguments
    const args = process.argv.slice(2);
    const dateArg = args.find(a => a.startsWith('--date='))?.split('=')[1];
    const dryRun = args.includes('--dry-run');
    const popularityThreshold = parseFloat(
        args.find(a => a.startsWith('--popularity='))?.split('=')[1] || String(DEFAULT_POPULARITY_THRESHOLD)
    );

    // Determine date
    const date = dateArg ? new Date(dateArg) : getTodayDate();
    console.log(`\n╔══════════════════════════════════════════════════════════════`);
    console.log(`║ TMDB Bulk Export Ingestion`);
    console.log(`║ Date: ${date.toISOString().split('T')[0]}`);
    console.log(`║ Popularity Threshold: ${popularityThreshold}`);
    console.log(`║ Dry Run: ${dryRun}`);
    console.log(`╚══════════════════════════════════════════════════════════════\n`);

    // Step 1: Download and parse export
    const rows = await downloadAndParseExport(date, popularityThreshold, DEFAULT_VOTE_COUNT_THRESHOLD);

    // Build popularity map
    const popularityMap = new Map<number, number>();
    for (const row of rows) {
        popularityMap.set(row.id, row.popularity);
    }

    // Step 2: Find new IDs
    const tmdbIds = rows.map(r => r.id);
    const newIds = await findNewIds(tmdbIds);

    // Step 3: Queue for harvesting (unless dry run)
    if (!dryRun && newIds.length > 0) {
        console.log(`\n📋 Queueing ${newIds.length} new shows for harvest...`);
        await queueForHarvest(newIds, popularityMap);
        console.log(`✅ Queue populated`);
    } else if (dryRun) {
        console.log(`\n🔍 DRY RUN - Would queue ${newIds.length} new shows`);
        // Log top 10 discoveries
        const topNew = newIds
            .slice(0, 10)
            .map(id => {
                const row = rows.find(r => r.id === id);
                return `  - ID ${id}: ${row?.original_name} (popularity: ${row?.popularity.toFixed(1)})`;
            });
        console.log(`\nTop discoveries:\n${topNew.join('\n')}`);
    }

    const duration = Date.now() - startTime;
    console.log(`\n⏱️ Completed in ${(duration / 1000).toFixed(1)}s\n`);

    return {
        totalRows: rows.length,
        filteredRows: rows.length,
        newIds: newIds.length,
        existingIds: tmdbIds.length - newIds.length,
        duration
    };
}

// Run if called directly
main()
    .then(result => {
        console.log(`📊 Summary:`);
        console.log(`   Total rows processed: ${result.totalRows}`);
        console.log(`   New IDs discovered: ${result.newIds}`);
        console.log(`   Existing IDs: ${result.existingIds}`);
        process.exit(0);
    })
    .catch(err => {
        console.error(`❌ Fatal error: ${err.message}`);
        process.exit(1);
    });

export { main as runBulkExportIngestion, type BulkExportResult };
