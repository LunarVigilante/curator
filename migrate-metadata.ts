import Database from 'better-sqlite3';

console.log('Adding metadata columns...');

const db = new Database('dev.db');

try {
    // Check if metadata column exists in categories
    const categoriesInfo = db.prepare("PRAGMA table_info(categories)").all();
    const categoriesHasMetadata = categoriesInfo.some((col: any) => col.name === 'metadata');

    if (!categoriesHasMetadata) {
        db.exec('ALTER TABLE categories ADD COLUMN metadata TEXT');
        console.log('✓ Added metadata column to categories');
    } else {
        console.log('✓ Categories metadata column already exists');
    }
} catch (e: any) {
    console.log('Error with categories:', e.message);
}

try {
    // Check if metadata column exists in items
    const itemsInfo = db.prepare("PRAGMA table_info(items)").all();
    const itemsHasMetadata = itemsInfo.some((col: any) => col.name === 'metadata');

    if (!itemsHasMetadata) {
        db.exec('ALTER TABLE items ADD COLUMN metadata TEXT');
        console.log('✓ Added metadata column to items');
    } else {
        console.log('✓ Items metadata column already exists');
    }
} catch (e: any) {
    console.log('Error with items:', e.message);
}

db.close();
console.log('Migration complete!');
