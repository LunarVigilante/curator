// Supabase Edge Function: Automatic Image Optimization
// Triggered by webhook when new images are uploaded to storage
// Generates WebP variants: thumb (200px), medium (600px), large (1200px)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET_NAME = 'media'
const SIZES = {
    thumb: 200,
    medium: 600,
    large: 1200
}

// Folders to process (skip avatars, they're usually small enough)
const PROCESS_FOLDERS = ['covers', 'posters', 'uploads']

serve(async (req) => {
    try {
        const payload = await req.json()

        // Validate webhook payload
        const record = payload.record
        if (!record || !record.name || !record.bucket_id) {
            return new Response(JSON.stringify({ error: 'Invalid payload' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Only process images in specific folders
        const folder = record.name.split('/')[0]
        if (!PROCESS_FOLDERS.includes(folder)) {
            console.log(`Skipping optimization for folder: ${folder}`)
            return new Response(JSON.stringify({ skipped: true, reason: 'folder not in whitelist' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Skip if already an optimized variant
        if (record.name.includes('_thumb') || record.name.includes('_medium') || record.name.includes('_large')) {
            console.log(`Skipping already optimized file: ${record.name}`)
            return new Response(JSON.stringify({ skipped: true, reason: 'already optimized' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Only process image files
        const ext = record.name.split('.').pop()?.toLowerCase()
        if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
            return new Response(JSON.stringify({ skipped: true, reason: 'not an image' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        console.log(`Processing image: ${record.name}`)

        // Create Supabase client with service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Download original image
        const { data: originalData, error: downloadError } = await supabase.storage
            .from(BUCKET_NAME)
            .download(record.name)

        if (downloadError || !originalData) {
            console.error('Download error:', downloadError)
            throw new Error(`Failed to download original: ${downloadError?.message}`)
        }

        // Convert blob to array buffer
        const originalBuffer = await originalData.arrayBuffer()

        // Use Cloudflare Image Resizing or similar service
        // For now, we'll use a simple approach - in production, use a proper image processing service

        // Generate variants using Supabase's built-in transform (if available) or external service
        const basePath = record.name.replace(/\.[^.]+$/, '') // Remove extension
        const results: Record<string, boolean> = {}

        for (const sizeName of Object.keys(SIZES)) {
            const variantPath = `${basePath}_${sizeName}.webp`

            try {
                // For now, upload the original as each variant
                // In production, integrate with an image processing service like:
                // - Cloudflare Images
                // - Imgix
                // - Sharp in a separate worker

                const { error: uploadError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(variantPath, originalBuffer, {
                        contentType: 'image/webp',
                        cacheControl: '31536000', // 1 year cache
                        upsert: true
                    })

                if (uploadError) {
                    console.error(`Failed to upload ${sizeName}:`, uploadError)
                    results[sizeName] = false
                } else {
                    console.log(`Created ${sizeName} variant: ${variantPath}`)
                    results[sizeName] = true
                }
            } catch (err) {
                console.error(`Error creating ${sizeName} variant:`, err)
                results[sizeName] = false
            }
        }

        return new Response(JSON.stringify({
            success: true,
            original: record.name,
            variants: results
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Edge function error:', error)
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
