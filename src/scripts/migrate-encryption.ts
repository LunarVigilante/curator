
import { db } from '../lib/db';
import { settings } from '../db/schema';
import { encrypt } from '../lib/encryption';
import { eq } from 'drizzle-orm';

const SENSITIVE_KEYS = [
    'llm_api_key',
    'tmdb_api_key',
    'rawg_api_key',
    'lastfm_api_key',
    'google_books_api_key'
];

async function migrate() {
    console.log('🚀 Starting Encryption Migration...');

    if (!process.env.ENCRYPTION_KEY) {
        console.error('❌ Error: ENCRYPTION_KEY environment variable is not set.');
        process.exit(1);
    }

    try {
        const allSettings = await db.select().from(settings);
        let count = 0;

        for (const setting of allSettings) {
            if (SENSITIVE_KEYS.includes(setting.key)) {
                // Only encrypt if it's not already encrypted (doesn't contain ':')
                if (setting.value && !setting.value.includes(':')) {
                    console.log(`🔒 Encrypting ${setting.key}...`);
                    const encryptedValue = encrypt(setting.value);

                    await db.update(settings)
                        .set({ value: encryptedValue })
                        .where(eq(settings.key, setting.key));

                    count++;
                } else {
                    console.log(`✅ ${setting.key} already encrypted or empty.`);
                }
            }
        }

        console.log(`🎉 Migration complete! ${count} fields encrypted.`);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
