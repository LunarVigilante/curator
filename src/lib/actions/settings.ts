'use server'

import { db } from '@/lib/db'
import { systemSettings } from '@/db/schema'
import { revalidatePath } from 'next/cache'

import { encrypt, decrypt } from '@/lib/encryption'
import { SystemSettings, SystemSettingKey } from '@/lib/services/SystemConfigService'

const SENSITIVE_KEYS = [
  'llm_api_key',
  'tmdb_api_key',
  'rawg_api_key',
  'lastfm_api_key',
  'google_books_api_key'
]

export async function getSettings(): Promise<SystemSettings> {
  const allSettings = await db.select().from(systemSettings)
  return allSettings.reduce((acc, setting) => {
    acc[setting.key as SystemSettingKey] = decrypt(setting.value)
    return acc
  }, {} as SystemSettings)
}

export async function updateSettings(formData: FormData) {
  // TODO: Add middleware check here requiring role=ADMIN once auth is implemented.
  const entries = Array.from(formData.entries())

  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      const isSecret = SENSITIVE_KEYS.includes(key)
      const finalValue = isSecret ? encrypt(value) : value

      await db.insert(systemSettings)
        .values({
          key,
          value: finalValue,
          category: 'GENERAL', // Default category for legacy updates
          isSecret: isSecret
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: finalValue,
            updatedAt: new Date()
          }
        })
    }
  }

  revalidatePath('/settings')
}
