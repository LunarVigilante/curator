import { db } from './src/lib/db.js';
import { categories } from './src/db/schema.js';

async function checkDb() {
    try {
        console.log('Checking database...');
        const allCategories = await db.select().from(categories);
        console.log('Categories found:', allCategories.length);
        console.log('First category:', allCategories[0]);

        if (allCategories.length > 0 && 'color' in allCategories[0]) {
            console.log('Color column exists!');
        } else {
            console.log('Color column MISSING or no categories found');
        }
    } catch (error) {
        console.error('Database error:', error);
    }
}

checkDb().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
