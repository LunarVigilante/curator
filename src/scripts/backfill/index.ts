#!/usr/bin/env npx tsx
/**
 * Comprehensive Metadata Backfill Script
 * 
 * REFACTORED into modular components for better maintainability.
 * 
 * This script processes items in phases to fill in missing metadata:
 * 1. Metadata - Fetches from TMDB/OMDB/etc (uses MetadataService)
 * 2. Descriptions - Generates 4-part structured descriptions (uses AIEnrichmentService)
 * 3. Tags - Generates AI tags
 * 4. Embeddings - Rebuilds embeddings using enriched metadata
 * 5. Full - Runs all phases at once using the unified pipeline
 * 6. Smart - Intelligent conditional updates (RECOMMENDED for improving embeddings):
 *    - Only refreshes metadata if required fields are missing
 *    - Only regenerates description if not all 4 parts exist
 *    - Only generates tags if missing
 *    - Regenerates embedding only if anything was updated
 * 
 * Usage:
 *   npx tsx src/scripts/backfill/index.ts --category=MOVIE
 *   npx tsx src/scripts/backfill/index.ts --category=TV_SHOW --limit=100
 *   npx tsx src/scripts/backfill/index.ts --category=ANIME --phase=metadata
 *   npx tsx src/scripts/backfill/index.ts --category=MOVIE --phase=full
 *   npx tsx src/scripts/backfill/index.ts --category=MOVIE --phase=smart --limit=500
 *   npx tsx src/scripts/backfill/index.ts --category=MOVIE --dry-run
 * 
 * Options:
 *   --category=<TYPE>  Required. Category to process (MOVIE, TV_SHOW, ANIME, VIDEO_GAME, etc.)
 *   --limit=<N>        Optional. Process only N items per phase
 *   --phase=<PHASE>    Optional. Run specific phase: metadata, descriptions, tags, embeddings, full, smart, all
 *   --dry-run          Optional. Preview changes without saving
 *   --force            Optional. Force regeneration even if data exists
 */

import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
    CLIOptions,
    Phase,
    PhaseStats,
    VALID_CATEGORIES,
    VALID_PHASES,
    createStats
} from './config';
import {
    runMetadataPhase,
    runDescriptionsPhase,
    runTagsPhase,
    runEmbeddingsPhase,
    runFullPhase,
    runSmartPhase,
    runRehydratePhase
} from './phases';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs(): CLIOptions {
    const args = process.argv.slice(2);

    const categoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1]?.toUpperCase();
    const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
    const phaseArg = args.find(a => a.startsWith('--phase='))?.split('=')[1]?.toLowerCase() as Phase;
    const dryRun = args.includes('--dry-run');
    const force = args.includes('--force');

    if (!categoryArg) {
        console.error('\n❌ ERROR: --category flag is required');
        console.error('   Usage: npx tsx src/scripts/backfill/index.ts --category=MOVIE\n');
        console.error('   Valid categories:', VALID_CATEGORIES.join(', '));
        process.exit(1);
    }

    if (!VALID_CATEGORIES.includes(categoryArg as any)) {
        console.error(`\n❌ ERROR: Invalid category "${categoryArg}"`);
        console.error('   Valid categories:', VALID_CATEGORIES.join(', '));
        process.exit(1);
    }

    const phase = phaseArg && VALID_PHASES.includes(phaseArg) ? phaseArg : 'all';

    return {
        category: categoryArg,
        limit: limitArg ? parseInt(limitArg, 10) : undefined,
        phase,
        dryRun,
        force
    };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const options = parseArgs();
    const supabase = createServiceRoleClient();

    console.log('\n' + '═'.repeat(70));
    console.log('🚀 COMPREHENSIVE METADATA BACKFILL (Modular Architecture)');
    console.log('═'.repeat(70));
    console.log(`📂 Category: ${options.category}`);
    console.log(`📦 Phase: ${options.phase}`);
    if (options.limit) console.log(`📊 Limit: ${options.limit} items per phase`);
    if (options.dryRun) console.log(`🔍 DRY RUN MODE: No changes will be saved`);
    if (options.force) console.log(`⚡ FORCE MODE: Regenerating even if data exists`);
    console.log('═'.repeat(70));

    const totals: Record<string, PhaseStats> = {
        metadata: createStats(),
        descriptions: createStats(),
        tags: createStats(),
        embeddings: createStats(),
        full: createStats(),
        smart: createStats(),
        rehydrate: createStats()
    };

    // Run phases based on selection
    if (options.phase === 'full') {
        // Full enrichment runs everything together
        totals.full = await runFullPhase(supabase, options);
    } else if (options.phase === 'smart') {
        // Smart enrichment - conditional updates
        totals.smart = await runSmartPhase(supabase, options);
    } else if (options.phase === 'rehydrate') {
        // Rehydrate - refresh stats and re-embed without LLM (TV shows only)
        totals.rehydrate = await runRehydratePhase(supabase, options);
    } else {
        // Individual phases
        if (options.phase === 'all' || options.phase === 'metadata') {
            totals.metadata = await runMetadataPhase(supabase, options);
        }

        if (options.phase === 'all' || options.phase === 'descriptions') {
            totals.descriptions = await runDescriptionsPhase(supabase, options);
        }

        if (options.phase === 'all' || options.phase === 'tags') {
            totals.tags = await runTagsPhase(supabase, options);
        }

        if (options.phase === 'all' || options.phase === 'embeddings') {
            totals.embeddings = await runEmbeddingsPhase(supabase, options);
        }
    }

    // Final summary
    console.log('\n' + '═'.repeat(70));
    console.log('✅ BACKFILL COMPLETE');
    console.log('═'.repeat(70));

    if (options.phase === 'full') {
        console.log(`🚀 Full:         ${totals.full.updated} updated, ${totals.full.skipped} skipped, ${totals.full.failed} failed`);
    } else if (options.phase === 'smart') {
        console.log(`🧠 Smart:        ${totals.smart.updated} updated, ${totals.smart.skipped} skipped, ${totals.smart.failed} failed`);
    } else if (options.phase === 'rehydrate') {
        console.log(`🔄 Rehydrate:    ${totals.rehydrate.updated} updated, ${totals.rehydrate.skipped} skipped, ${totals.rehydrate.failed} failed`);
    } else {
        console.log(`📡 Metadata:     ${totals.metadata.updated} updated, ${totals.metadata.skipped} skipped, ${totals.metadata.failed} failed`);
        console.log(`📝 Descriptions: ${totals.descriptions.updated} updated, ${totals.descriptions.skipped} skipped, ${totals.descriptions.failed} failed`);
        console.log(`🏷️  Tags:         ${totals.tags.updated} updated, ${totals.tags.skipped} skipped, ${totals.tags.failed} failed`);
        console.log(`🧮 Embeddings:   ${totals.embeddings.updated} updated, ${totals.embeddings.skipped} skipped, ${totals.embeddings.failed} failed`);
    }

    console.log('═'.repeat(70) + '\n');
}

main().catch(console.error);
