'use server'

import { db } from '@/lib/db'
import { settings } from '@/db/schema'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
  const allSettings = await db.select().from(settings)
  return allSettings.reduce((acc, setting) => {
    acc[setting.key] = setting.value
    return acc
  }, {} as Record<string, string>)
}

export async function updateSettings(formData: FormData) {
  const entries = Array.from(formData.entries())

  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      await db.insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value }
        })
    }
  }

  revalidatePath('/settings')
}
