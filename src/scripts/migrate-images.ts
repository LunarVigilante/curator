

import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { sleep } from '@/lib/harvesters/shared';

const supabase = createServiceRoleClient();
const imageService = new ImageService();

async function migrateImages() {
    console.log('🖼️ STARTING IMAGE MIGRATION...');

    // Get total count of items with external images
    const { count } = await supabase
        .from('global_items')
        .select('*', { count: 'exact', head: true })
        .not('image_url', 'is', null)
        .not('image_url', 'ilike', '%supabase.co%'); // Filter out already hosted

    console.log(`📊 Found ${count} items with external images.`);

    if (!count || count === 0) {
        console.log('✅ No images to migrate.');
        return;
    }

    const BATCH_SIZE = 50;
    let processed = 0;
    let success = 0;
    let failed = 0;

    // We can't easily offset/limit with potential updates modifying the set if we filtered by "not ilike supabase",
    // but updates will move them out of the filter set.
    // So we can just keep fetching the first batch until none remain.

    while (true) {
        const { data: items, error } = await supabase
            .from('global_items')
            .select('id, title, image_url, category_type')
            .not('image_url', 'is', null)
            .not('image_url', 'ilike', '%supabase.co%')
            .limit(BATCH_SIZE) as any;

        if (error) {
            console.error('❌ Error fetching batch:', error);
            break;
        }

        if (!items || items.length === 0) {
            break;
        }

        console.log(`   Processing batch of ${items.length}...`);

        for (const item of items) {
            try {
                if (!item.image_url) continue;

                // Determine prefix based on category
                let prefix: 'anime' | 'game' | 'movie' | 'tv' | 'book' | 'music' | 'misc' = 'misc';
                const cat = item.category_type?.toLowerCase() || '';
                if (cat.includes('anime')) prefix = 'anime';
                else if (cat.includes('game') || cat.includes('videogame') || cat.includes('board')) prefix = 'game';
                else if (cat.includes('movie')) prefix = 'movie';
                else if (cat === 'tv') prefix = 'tv';
                else if (cat.includes('book')) prefix = 'book';
                else if (cat.includes('music')) prefix = 'music';

                const newUrl = await imageService.processAndUpload(item.image_url, prefix);

                if (newUrl) {
                    const { error: updateError } = await (supabase
                        .from('global_items') as any)
                        .update({ image_url: newUrl })
                        .eq('id', item.id);

                    if (updateError) {
                        console.error(`   ❌ Failed to update DB for "${item.title}":`, updateError);
                        failed++;
                    } else {
                        // console.log(`   ✅ Migrated: ${item.title}`);
                        success++;
                    }
                } else {
                    console.warn(`   ⚠️ Processing failed for "${item.title}" (${item.image_url})`);
                    failed++;
                }

            } catch (err) {
                console.error(`   ❌ Unexpected error for "${item.title}":`, err);
                failed++;
            }
        }

        processed += items.length;
        console.log(`   Progress: ${processed}/${count} processed (${success} success, ${failed} failed)`);

        await sleep(100); // Cool down
    }

    console.log(`\n✅ MIGRATION COMPLETE`);
    console.log(`   Total: ${processed}`);
    console.log(`   Success: ${success}`);
    console.log(`   Failed: ${failed}`);
}

migrateImages().catch(console.error);
