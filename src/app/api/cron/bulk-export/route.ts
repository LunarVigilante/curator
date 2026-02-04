/**
 * Cron Job: TMDB Bulk Export Ingestion
 * 
 * Runs daily at 09:00 UTC (after TMDB publishes exports at 08:00 UTC)
 * Downloads and processes the daily TV series export file.
 * 
 * Vercel Cron: 0 9 * * *
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

    console.log('📥 Starting TMDB bulk export ingestion...');

    try {
        // Import and run the bulk export script
        const { runBulkExportIngestion } = await import('@/scripts/harvest-bulk-export');
        const result = await runBulkExportIngestion();

        console.log(`✅ Bulk export completed: ${result.newIds} new IDs discovered`);

        return NextResponse.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('❌ Bulk export failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
