/**
 * Cron Job: TMDB Delta Sync
 * 
 * Runs every 6 hours to check for recently changed TV shows.
 * Uses semantic hash comparison to only re-embed when content changes.
 * 
 * Schedule: Every 6 hours at minute 0
 */

import { NextResponse } from 'next/server';

// Vercel cron jobs have a maximum execution time
export const maxDuration = 60; // 60 seconds (Pro plan limit)

export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.log('🚫 Unauthorized cron request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting TMDB delta sync...');

    try {
        // Import and run the delta sync script
        const { runDeltaSync } = await import('@/scripts/sync-changes');
        const result = await runDeltaSync();

        console.log(`✅ Delta sync completed: ${result.reembedRequired} items need re-embedding`);

        return NextResponse.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('❌ Delta sync failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
