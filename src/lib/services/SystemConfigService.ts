import { db } from '@/lib/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { unstable_noStore as noStore } from 'next/cache';

export class SystemConfigService {
    /**
     * READ: Fetches and decrypts a setting for internal server use.
     * WARNING: Never expose the result of this directly to the client API response
     * if the setting is marked as secret.
     */
    static async getDecryptedConfig(key: string): Promise<string | null> {
        noStore();
        const setting = await db.query.systemSettings.findFirst({
            where: eq(systemSettings.key, key),
        });

        if (!setting) return null;

        // Decrypt the value before returning
        return decrypt(setting.value);
    }

    /**
     * MANAGE: Fetches all settings for the Admin Dashboard.
     * Automatically masks secrets.
     */
    static async getAllSettings() {
        noStore();
        const allSettings = await db.query.systemSettings.findMany({
            orderBy: systemSettings.category,
        });

        return allSettings.map(setting => ({
            key: setting.key,
            value: setting.isSecret ? '********' : decrypt(setting.value),
            category: setting.category,
            isSecret: setting.isSecret,
            updatedAt: setting.updatedAt,
        }));
    }

    /**
     * UPDATE: Encrypts and saves a setting.
     */
    static async updateSetting(
        key: string,
        rawValue: string,
        category: string = 'GENERAL',
        isSecret: boolean = false
    ) {
        // Encrypt immediately
        const encryptedValue = encrypt(rawValue);

        // Upsert logic
        await db.insert(systemSettings)
            .values({
                key,
                value: encryptedValue,
                category,
                isSecret,
            })
            .onConflictDoUpdate({
                target: systemSettings.key,
                set: {
                    value: encryptedValue,
                    category,
                    isSecret,
                    updatedAt: new Date(),
                },
            });

        // Return public view (masked if secret)
        return {
            key,
            value: isSecret ? '********' : rawValue,
            category,
            isSecret,
        };
    }
}
