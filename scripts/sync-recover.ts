/**
 * Sync Recovery Script (v5.0)
 * 
 * Sweeps for failed embedding operations and retries with TPM-safe mode.
 * Designed to run as a CRON job to ensure 100% vector coverage.
 * 
 * Usage: npx tsx scripts/sync-recover.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAX_ITEMS_PER_RUN = 100;
const MAX_TOKEN_CHARS = 8000;  // ~2000 tokens, safe limit for Voyage API

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface FailedItem {
    id: string;
    title: string;
    sync_error: string | null;
    overview: string | null;
    genres: string[] | null;
    cast_names: string[] | null;
}

interface EmbeddingResult {
    id: string;
    success: boolean;
    error?: string;
    error_code?: string;
}

function buildEmbeddingText(item: FailedItem): string {
    const parts: string[] = [];

    if (item.title) parts.push(item.title);
    if (item.overview) parts.push(item.overview);
    if (item.genres?.length) parts.push(`Genres: ${item.genres.join(', ')}`);
    if (item.cast_names?.length) parts.push(`Cast: ${item.cast_names.slice(0, 5).join(', ')}`);

    let text = parts.join(' | ');

    // v5.0: Truncate for TOKEN_LIMIT errors to prevent dead-end retries
    if (item.sync_error === 'TOKEN_LIMIT' && text.length > MAX_TOKEN_CHARS) {
        console.log(`✂️ Truncating ${item.title} (${text.length} -> ${MAX_TOKEN_CHARS} chars)`);
        text = text.slice(0, MAX_TOKEN_CHARS);
    }

    return text;
}

async function main() {
    console.log('🔍 Sync Recovery Sweep starting...');
    console.log(`📅 ${new Date().toISOString()}`);

    // Find failed items
    const { data: failed, error: fetchError } = await supabase
        .from('global_items')
        .select('id, title, sync_error, overview, genres, cast_names')
        .eq('sync_status', 'failed')
        .limit(MAX_ITEMS_PER_RUN);

    if (fetchError) {
        console.error('❌ Failed to fetch items:', fetchError.message);
        process.exit(1);
    }

    if (!failed || failed.length === 0) {
        console.log('✅ No failed items to recover');
        return;
    }

    console.log(`🔄 Recovering ${failed.length} failed items...`);

    // Log error distribution
    const errorCounts = failed.reduce((acc, item) => {
        const error = item.sync_error || 'UNKNOWN';
        acc[error] = (acc[error] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log('📊 Error distribution:', errorCounts);

    // Build embedding payloads
    const items = failed.map(item => ({
        id: item.id,
        text: buildEmbeddingText(item as FailedItem)
    }));

    // Retry with TPM-safe mode
    const { data: response, error: invokeError } = await supabase.functions.invoke('batch-embedding', {
        body: {
            items,
            tpm_safe: true  // Conservative 64-item batches
        }
    });

    if (invokeError) {
        console.error('❌ Edge Function invocation failed:', invokeError.message);
        process.exit(1);
    }

    // Update status based on results
    let successCount = 0;
    let failCount = 0;

    for (const result of (response.results as EmbeddingResult[])) {
        const { error: updateError } = await supabase
            .from('global_items')
            .update({
                sync_status: result.success ? 'synced' : 'failed',
                sync_error: result.success ? null : result.error_code
            })
            .eq('id', result.id);

        if (updateError) {
            console.error(`⚠️ Failed to update ${result.id}:`, updateError.message);
            failCount++;
        } else if (result.success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    console.log(`✅ Recovery complete: ${successCount}/${failed.length} succeeded`);

    if (failCount > 0) {
        console.log(`⚠️ ${failCount} items still failed (will retry next run)`);
    }

    // Check if more items remain
    const { count } = await supabase
        .from('global_items')
        .select('*', { count: 'exact', head: true })
        .eq('sync_status', 'failed');

    if (count && count > 0) {
        console.log(`📋 ${count} total items still pending recovery`);
    }
}

main().catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
