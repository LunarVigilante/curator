
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import pLimit from 'p-limit'
import { SteamGridDBService } from '../lib/services/steamgriddb'
import { ImageService } from '../lib/services/image/imageService'
import { Database } from '../lib/types/database';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
})

const imageService = new ImageService('images') // default bucket

const CONCURRENCY_LIMIT = 5
const limit = pLimit(CONCURRENCY_LIMIT)

interface GameItem {
    id: string
    title: string
    image_url: string | null
    metadata: Record<string, any>
}

// Helper for DB retries
async function dbRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await operation()
    } catch (err: any) {
        if (retries > 0 && (err.code === '57014' || err.message?.includes('timeout'))) {
            console.warn(`   ⚠️ DB Timeout. Retrying in ${delay}ms...`)
            await new Promise(r => setTimeout(r, delay))
            return dbRetry(operation, retries - 1, delay * 2)
        }
        throw err
    }
}

async function upgradeGameImages() {
    console.log('🚀 Starting SteamGridDB Image Upgrade...')

    // 1. Fetch Candidates
    // Query items where source is RAWG OR category is 'Video Game'
    // AND we haven't already marked them as having SteamGridDB art
    const { data: items, error } = await supabase
        .from('global_items')
        .select('id, title, image_url, metadata')
        .or('source.eq.rawg,category_type.eq.VIDEO_GAME')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Error fetching items:', error)
        process.exit(1)
    }

    // Filter out items already processed (client-side filter for robust JSON checking)
    const candidates = items.filter((item: any) => {
        const meta = item.metadata || {}
        // Skip if already has SteamGridDB source or specifically marked as checked/done
        if (meta.image_source === 'SteamGridDB') return false
        if (meta.image_checked === true) return false
        return true
    })

    console.log(`📋 Found ${candidates.length} candidates for upgrade.`)

    let upgradedCount = 0
    let skippedCount = 0
    let errors = 0

    // 2. Process Items with Concurrency
    const promises = candidates.map((item: any) => limit(async () => {
        try {
            await processItem(item)
            upgradedCount++
        } catch (e) {
            console.error(`❌ Failed to process "${item.title}":`, e)
            errors++
        }
    }))

    await Promise.all(promises)

    console.log('\n🎉 Upgrade Complete!')
    console.log(`✅ Upgraded: ${upgradedCount}`)
    console.log(`⏭️  Skipped/No Better Art: ${skippedCount}`)
    console.log(`❌ Errors: ${errors}`)
}

async function processItem(item: GameItem) {
    const meta = item.metadata || {}
    let steamAppId = meta.steam_app_id

    // Try to extract steam ID from external_ids if not in metadata root
    if (!steamAppId && item.metadata?.external_ids?.steam) {
        steamAppId = item.metadata.external_ids.steam
    }

    console.log(`🔍 Checking: "${item.title}" ${steamAppId ? `(SteamID: ${steamAppId})` : ''}`)

    let newCoverUrl: string | null = null

    try {
        newCoverUrl = await SteamGridDBService.getBestCoverArt(item.title, steamAppId)
    } catch (e: any) {
        if (e.message?.includes('429')) {
            console.warn(`⏳ Rate limit hit for "${item.title}", waiting...`)
            await new Promise(r => setTimeout(r, 2000)) // Simple backoff
            // Retry once
            try {
                newCoverUrl = await SteamGridDBService.getBestCoverArt(item.title, steamAppId)
            } catch (retryErr) {
                console.error(`❌ Failed retry for "${item.title}"`)
            }
        }
    }

    if (newCoverUrl) {
        // Step C: The Swap
        console.log(`   ⬇️  Found new art! processing...`)

        try {
            // Process and upload to Supabase Storage
            const finalUrl = await imageService.processAndUpload(newCoverUrl, 'game') // Using 'game' prefix

            if (finalUrl) {
                // Update DB with Retry
                await dbRetry(async () => {
                    const { error: updateError } = await (supabase
                        .from('global_items') as any)
                        .update({
                            image_url: finalUrl,
                            metadata: {
                                ...meta,
                                image_source: 'SteamGridDB',
                                image_updated_at: new Date().toISOString()
                            }
                        } as any) // Casting as any to avoid strict type issues with jsonb updates
                        .eq('id', item.id)

                    if (updateError) throw updateError
                })

                console.log(`   ✅ Upgraded: "${item.title}"`)
            }
        } catch (err) {
            console.error(`   ❌ Failed to upload/update image for "${item.title}":`, err)
            throw err
        }

    } else {
        // Log: No better art found
        console.log(`   ⚠️  No better art found for: "${item.title}"`)

        // Update metadata so we don't check again immediately
        await (supabase
            .from('global_items') as any)
            .update({
                metadata: {
                    ...meta,
                    image_checked: true,
                    image_check_date: new Date().toISOString()
                }
            } as any)
            .eq('id', item.id)
    }
}

// Execute
upgradeGameImages().catch(e => {
    console.error('Fatal Script Error:', e)
    process.exit(1)
})
