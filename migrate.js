const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('dev.db');

async function migrate() {
    console.log('🚀 Starting Master/Instance Data Migration (JS)...');

    try {
        // 1. Fetch all items and categories
        const allItems = db.prepare("SELECT * FROM items").all();
        const allCategories = db.prepare("SELECT * FROM categories").all();
        const allRatings = db.prepare("SELECT * FROM ratings WHERE type = 'TIER'").all();

        console.log(`Found ${allItems.length} items to migrate.`);

        db.transaction(() => {
            for (const item of allItems) {
                // Skip if already migrated
                if (item.global_item_id) {
                    console.log(`Skipping item ${item.name} (already migrated)`);
                    continue;
                }

                console.log(`Processing item: ${item.name}...`);

                // 2. Determine externalId and global metadata
                let externalId = null;
                let metadataObj = {};
                if (item.metadata) {
                    try {
                        metadataObj = JSON.parse(item.metadata);
                        externalId = metadataObj.externalId || metadataObj.id || null;
                    } catch (e) {
                        // ignore
                    }
                }

                // 3. Upsert GlobalItem
                let globalItemId;
                let existingGlobal;

                if (externalId) {
                    existingGlobal = db.prepare("SELECT * FROM global_items WHERE external_id = ?").get(externalId);
                } else {
                    existingGlobal = db.prepare("SELECT * FROM global_items WHERE title = ? AND image_url = ?").get(item.name || '', item.image || '');
                }

                if (existingGlobal) {
                    globalItemId = existingGlobal.id;
                    console.log(`  Linked to existing GlobalItem: ${existingGlobal.title}`);
                } else {
                    globalItemId = crypto.randomUUID();
                    db.prepare(`
                        INSERT INTO global_items (id, external_id, title, description, image_url, metadata)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(
                        globalItemId,
                        externalId,
                        item.name || 'Untitled',
                        item.description,
                        item.image,
                        item.metadata
                    );
                    console.log(`  Created new GlobalItem: ${item.name}`);
                }

                // 4. Get User ID from category
                const category = allCategories.find(c => c.id === item.category_id);
                const userId = category ? category.user_id : null;

                // 5. Get Tier from ratings table
                const tierRating = allRatings.find(r => r.item_id === item.id);
                const tier = tierRating ? tierRating.tier : null;

                // 6. Update Item record
                db.prepare(`
                    UPDATE items
                    SET global_item_id = ?, user_id = ?, tier = ?
                    WHERE id = ?
                `).run(
                    globalItemId,
                    userId,
                    tier,
                    item.id
                );

                console.log(`  Updated item ${item.id} with globalId and tier ${tier}.`);
            }
        })();

        console.log('🎉 Migration complete!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        db.close();
    }
}

migrate();
