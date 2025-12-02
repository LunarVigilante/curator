import Database from 'better-sqlite3';

console.log('Adding color column to categories...');

const db = new Database('dev.db');

try {
    const categoriesInfo = db.prepare("PRAGMA table_info(categories)").all() as { name: string }[];
    const hasColor = categoriesInfo.some((col) => col.name === 'color');

    if (!hasColor) {
        db.exec('ALTER TABLE categories ADD COLUMN color TEXT');
        console.log('✓ Added color column to categories');
    } else {
        console.log('✓ Color column already exists');
    }
} catch (e: any) {
    console.log('Error:', e.message);
}

db.close();
console.log('Migration complete!');
