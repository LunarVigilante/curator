#!/usr/bin/env npx tsx
/**
 * BGG Lists Harvester Script
 * 
 * Usage:
 *   npx tsx src/scripts/harvest-bgg-lists.ts hotness
 *   npx tsx src/scripts/harvest-bgg-lists.ts geeklist 306630
 *   npx tsx src/scripts/harvest-bgg-lists.ts geeklist 306630 "Top Solo Games"
 */

import 'dotenv/config';
import { createServiceRoleClient } from '../lib/supabase/service-role';
import { harvestHotness, harvestGeekList, POPULAR_GEEKLISTS } from '../lib/harvesters/bgg-lists';

async function main() {
    const args = process.argv.slice(2);
    const command = args[0]?.toLowerCase();

    const supabase = createServiceRoleClient();

    if (!command) {
        console.log(`
BGG Lists Harvester

Usage:
  npx tsx src/scripts/harvest-bgg-lists.ts hotness
  npx tsx src/scripts/harvest-bgg-lists.ts geeklist <id> [name]

Examples:
  npx tsx src/scripts/harvest-bgg-lists.ts hotness
  npx tsx src/scripts/harvest-bgg-lists.ts geeklist 306630 "Top Solo Games"
  npx tsx src/scripts/harvest-bgg-lists.ts geeklist 278832 "Best Two-Player"

Popular GeekLists:
  - 306630: Top 100 Solo Games
  - 278832: Best Two-Player Only Games
  - 164153: Gateway Games
  - 41186:  Best Party Games
  - 186827: Best Family Games
`);
        process.exit(0);
    }

    console.log('🎲 BGG Lists Harvester');
    console.log('='.repeat(50));

    switch (command) {
        case 'hotness':
            await harvestHotness(supabase);
            break;

        case 'geeklist':
            const listId = parseInt(args[1]);
            if (!listId || isNaN(listId)) {
                console.error('❌ Please provide a valid GeekList ID');
                console.log('   Example: npx tsx src/scripts/harvest-bgg-lists.ts geeklist 306630');
                process.exit(1);
            }
            const listName = args[2] || undefined;
            await harvestGeekList(supabase, listId, listName);
            break;

        case 'popular':
            // Harvest all popular lists
            console.log('📋 Harvesting all popular GeekLists...\n');
            for (const [key, list] of Object.entries(POPULAR_GEEKLISTS)) {
                console.log(`\n${'='.repeat(50)}`);
                await harvestGeekList(supabase, list.id, list.name);
            }
            break;

        default:
            console.error(`❌ Unknown command: ${command}`);
            console.log('   Valid commands: hotness, geeklist, popular');
            process.exit(1);
    }

    console.log('\n✅ Done!');
}

main().catch(err => {
    console.error('💥 Unhandled Error:', err);
    process.exit(1);
});
