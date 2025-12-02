import { db } from './src/lib/db.js';
import { categories } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function cleanup() {
    console.log('Cleaning up test category...');
    await db.delete(categories).where(eq(categories.name, 'Test Cat'));
    console.log('✓ Deleted "Test Cat"');
}

cleanup().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
