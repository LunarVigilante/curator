'use server'

import { db } from '@/lib/db'
import { settings } from '@/db/schema'
import { revalidatePath } from 'next/cache'

import { encrypt, decrypt } from '@/lib/encryption'

const SENSITIVE_KEYS = [
  'llm_api_key',
  'tmdb_api_key',
  'rawg_api_key',
  'lastfm_api_key',
  'google_books_api_key'
]

export async function getSettings() {
  const allSettings = await db.select().from(settings)
  return allSettings.reduce((acc, setting) => {
    acc[setting.key] = decrypt(setting.value)
    return acc
  }, {} as Record<string, string>)
}

export async function updateSettings(formData: FormData) {
  // TODO: Add middleware check here requiring role=ADMIN once auth is implemented.
  const entries = Array.from(formData.entries())

  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      const finalValue = SENSITIVE_KEYS.includes(key) ? encrypt(value) : value

      await db.insert(settings)
        .values({ key, value: finalValue })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: finalValue }
        })
    }
  }

  revalidatePath('/settings')
}
