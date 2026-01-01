'use server'

import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

const BUCKET_NAME = 'media'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

/**
 * Upload an image file to Supabase Storage.
 * @param formData - FormData containing 'file' field
 * @param folder - Optional folder path (default: 'uploads')
 * @returns Public URL of the uploaded file
 */
export async function uploadImage(formData: FormData, folder = 'uploads'): Promise<string | null> {
    try {
        const file = formData.get('file') as File

        if (!file || file.size === 0) {
            return null
        }

        // Validate file type
        if (!VALID_TYPES.includes(file.type)) {
            throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.')
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            throw new Error('File too large. Maximum size is 10MB.')
        }

        const supabase = await createClient()

        // Generate unique filename
        const bytes = randomBytes(16).toString('hex')
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `${bytes}.${ext}`
        const filePath = `${folder}/${filename}`

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        console.log(`[uploadImage] Uploading to Supabase Storage: ${filePath}`)

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            })

        if (error) {
            console.error('[uploadImage] Supabase upload error:', error)
            throw error
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path)

        console.log(`[uploadImage] Upload complete: ${urlData.publicUrl}`)
        return urlData.publicUrl
    } catch (error) {
        console.error('Image upload failed:', error)
        return null
    }
}

/**
 * Download an image from an external URL and upload to Supabase Storage.
 * This ensures all images are stored in our own storage, not linked externally.
 * 
 * @param url - External image URL (e.g., from TMDB)
 * @param folder - Folder path in storage (default: 'covers')
 * @returns Public URL of the uploaded file
 */
export async function downloadImageFromUrl(url: string, folder = 'covers'): Promise<string | null> {
    try {
        if (!url || !url.startsWith('http')) {
            return null
        }

        // Skip if already a Supabase Storage URL
        if (url.includes('supabase.co/storage')) {
            console.log('[downloadImageFromUrl] Already a Supabase URL, skipping download')
            return url
        }

        console.log(`[downloadImageFromUrl] Downloading: ${url}`)

        const isComicVine = url.includes('comicvine.gamespot.com')
        const userAgent = isComicVine
            ? 'Curator/1.0 (Personal Collection Manager)'
            : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

        const headers: HeadersInit = {
            'User-Agent': userAgent
        }

        if (isComicVine) {
            headers['Referer'] = 'https://comicvine.gamespot.com/'
            headers['Accept'] = 'image/webp,image/apng,image/*,*/*;q=0.8'
        }

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`)
        }

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error('URL does not point to an image')
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Generate unique filename
        const bytes = randomBytes(16).toString('hex')

        // Get extension from URL or content-type
        let ext = url.split('.').pop()?.split(/[?#]/)[0]?.toLowerCase()
        if (!ext || ext.length > 4 || !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
            ext = contentType.split('/').pop() || 'jpg'
            if (ext === 'jpeg') ext = 'jpg'
        }

        const filename = `${bytes}.${ext}`
        const filePath = `${folder}/${filename}`

        const supabase = await createClient()

        console.log(`[downloadImageFromUrl] Uploading to Supabase: ${filePath}`)

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType,
                cacheControl: '3600',
                upsert: false
            })

        if (error) {
            console.error('[downloadImageFromUrl] Supabase upload error:', error)
            throw error
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path)

        console.log(`[downloadImageFromUrl] Complete: ${urlData.publicUrl}`)
        return urlData.publicUrl
    } catch (error) {
        console.error(`Failed to download/upload image from URL: ${url}`, error)
        return null
    }
}

/**
 * Upload avatar image with user-specific path.
 */
export async function uploadAvatar(formData: FormData, userId: string): Promise<string | null> {
    try {
        const file = formData.get('file') as File
        if (!file || file.size === 0) return null

        const supabase = await createClient()
        const bytes = randomBytes(8).toString('hex')
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filePath = `avatars/${userId}/${bytes}.${ext}`

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: true // Overwrite if exists
            })

        if (error) throw error

        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path)

        return urlData.publicUrl
    } catch (error) {
        console.error('Avatar upload failed:', error)
        return null
    }
}

/**
 * Delete an image from Supabase Storage.
 */
export async function deleteImage(path: string): Promise<boolean> {
    try {
        // Extract path from full URL if needed
        let storagePath = path
        if (path.includes('/storage/v1/object/public/media/')) {
            storagePath = path.split('/storage/v1/object/public/media/')[1]
        }

        const supabase = await createClient()
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([storagePath])

        if (error) throw error
        return true
    } catch (error) {
        console.error('Image delete failed:', error)
        return false
    }
}
