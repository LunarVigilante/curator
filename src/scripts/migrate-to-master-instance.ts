import { db } from '../lib/db';
import { items, globalItems, ratings, categories } from '../db/schema';
import { eq, and } from 'drizzle-orm';

async function migrate() {
    console.log('🚀 Starting Master/Instance Data Migration...');

    try {
        // 1. Fetch all items and categories
        const allItems = await db.select().from(items);
        const allCategories = await db.select().from(categories);

        console.log(`Found ${allItems.length} items to migrate.`);

        for (const item of allItems) {
            // Skip if already migrated
            if (item.globalItemId) {
                console.log(`Skipping item ${item.name} (already migrated)`);
                continue;
            }

            console.log(`Processing item: ${item.name}...`);

            // 2. Determine externalId and global metadata
            // Try to extract externalId from metadata JSON
            let externalId: string | null = null;
            let metadataObj: any = {};
            if (item.metadata) {
                try {
                    metadataObj = JSON.parse(item.metadata);
                    externalId = metadataObj.externalId || metadataObj.id || null;
                } catch (e) {
                    console.warn(`Failed to parse metadata for ${item.name}`);
                }
            }

            // 3. Upsert GlobalItem
            let globalItemId: string;

            // Search for existing GlobalItem by externalId or exact title+image
            let existingGlobal: any = null;
            if (externalId) {
                existingGlobal = await db.query.globalItems.findFirst({
                    where: eq(globalItems.externalId, externalId)
                });
            } else {
                existingGlobal = await db.query.globalItems.findFirst({
                    where: and(
                        eq(globalItems.title, item.name || ''),
                        eq(globalItems.imageUrl, item.image || '')
                    )
                });
            }

            if (existingGlobal) {
                globalItemId = existingGlobal.id;
                console.log(`  Linked to existing GlobalItem: ${existingGlobal.title}`);
            } else {
                const [newGlobal] = await db.insert(globalItems).values({
                    externalId: externalId,
                    title: item.name || 'Untitled',
                    description: item.description,
                    imageUrl: item.image,
                    metadata: item.metadata,
                    // categoryType could be guessed from category, but leave for now
                }).returning();
                globalItemId = newGlobal.id;
                console.log(`  Created new GlobalItem: ${newGlobal.title}`);
            }

            // 4. Get User ID from category
            const category = allCategories.find(c => c.id === item.categoryId);
            const userId = category?.userId || null;

            // 5. Get Tier from ratings table
            const tierRating = await db.query.ratings.findFirst({
                where: and(
                    eq(ratings.itemId, item.id),
                    eq(ratings.type, 'TIER')
                )
            });
            const tier = tierRating?.tier || null;

            // 6. Update Item record
            await db.update(items)
                .set({
                    globalItemId,
                    userId,
                    tier,
                })
                .where(eq(items.id, item.id));

            console.log(`  Updated item ${item.id} with globalId and tier ${tier}.`);
        }

        console.log('🎉 Migration complete!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();

