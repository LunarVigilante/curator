'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { encrypt, decrypt } from '@/lib/encryption'
import { SystemSettings, SystemSettingKey } from '@/lib/services/SystemConfigService'

const SENSITIVE_KEYS = [
  'llm_api_key',
  'tmdb_api_key',
  'rawg_api_key',
  'lastfm_api_key',
  'google_books_api_key',
  'tvdb_api_key',
  'tvdb_pin'
]

export async function getSettings(): Promise<SystemSettings> {
  const supabase = await createClient()

  const { data: allSettings, error } = await (supabase.from('system_settings') as any)
    .select('*')

  if (error) throw error

  return (allSettings || []).reduce((acc: SystemSettings, setting: any) => {
    acc[setting.key as SystemSettingKey] = decrypt(setting.value)
    return acc
  }, {} as SystemSettings)
}

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()
  const entries = Array.from(formData.entries())

  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      const isSecret = SENSITIVE_KEYS.includes(key)
      const finalValue = isSecret ? encrypt(value) : value

      // Supabase upsert
      await (supabase.from('system_settings') as any)
        .upsert({
          key,
          value: finalValue,
          category: 'GENERAL',
          is_secret: isSecret,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        })
    }
  }

  revalidatePath('/settings')
}
