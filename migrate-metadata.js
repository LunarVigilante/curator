import { db } from './src/lib/db.js';

console.log('Adding metadata columns...');

try {
    // Add metadata column to categories table
    db.exec('ALTER TABLE categories ADD COLUMN metadata TEXT');
    console.log('✓ Added metadata column to categories');
} catch (e) {
    console.log('Categories metadata column may already exist:', e.message);
}

try {
    // Add metadata column to items table
    db.exec('ALTER TABLE items ADD COLUMN metadata TEXT');
    console.log('✓ Added metadata column to items');
} catch (e) {
    console.log('Items metadata column may already exist:', e.message);
}

console.log('Migration complete!');
