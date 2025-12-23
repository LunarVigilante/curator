const Database = require('better-sqlite3');
const db = new Database('dev.db');

try {
    console.log('Manually refactoring items table...');

    db.transaction(() => {
        db.prepare("PRAGMA foreign_keys=OFF").run();

        // 1. Create global_items if not exists
        db.prepare(`
            CREATE TABLE IF NOT EXISTS \`global_items\` (
                \`id\` text PRIMARY KEY NOT NULL,
                \`external_id\` text UNIQUE,
                \`title\` text NOT NULL,
                \`description\` text,
                \`image_url\` text,
                \`release_year\` integer,
                \`metadata\` text,
                \`category_type\` text,
                \`created_at\` integer DEFAULT (unixepoch()) NOT NULL
            )
        `).run();

        // 2. Prepare new_items with the desired schema
        db.prepare(`
            CREATE TABLE IF NOT EXISTS \`__new_items\` (
                \`id\` text PRIMARY KEY NOT NULL,
                \`name\` text,
                \`description\` text,
                \`image\` text,
                \`metadata\` text,
                \`global_item_id\` text,
                \`user_id\` text,
                \`tier\` text,
                \`rank\` integer,
                \`notes\` text,
                \`category_id\` text,
                \`elo_score\` real DEFAULT 1200 NOT NULL,
                \`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
                \`updated_at\` integer DEFAULT (unixepoch()) NOT NULL,
                FOREIGN KEY (\`global_item_id\`) REFERENCES \`global_items\`(\`id\`) ON DELETE CASCADE,
                FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
                FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE SET NULL
            )
        `).run();

        // 3. Migrate data from old items to __new_items
        // Old columns: id, name, description, image, category_id, metadata, elo_score, created_at, updated_at
        console.log('Migrating data...');
        db.prepare(`
            INSERT INTO \`__new_items\` (
                id, name, description, image, category_id, metadata, elo_score, created_at, updated_at
            ) SELECT 
                id, name, description, image, category_id, metadata, elo_score, created_at, updated_at 
            FROM \`items\`
        `).run();

        // 4. Swap tables
        console.log('Swapping tables...');
        db.prepare("DROP TABLE \`items\`").run();
        db.prepare("ALTER TABLE \`__new_items\` RENAME TO \`items\`").run();

        db.prepare("PRAGMA foreign_keys=ON").run();
    })();

    console.log('Success! Items table refactored.');
} catch (error) {
    console.error('Refactor failed:', error);
} finally {
    db.close();
}
