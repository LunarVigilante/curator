'use server'

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'

export async function uploadImage(formData: FormData): Promise<string | null> {
    try {
        const file = formData.get('file') as File

        if (!file || file.size === 0) {
            return null
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if (!validTypes.includes(file.type)) {
            throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.')
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024 // 5MB
        if (file.size > maxSize) {
            throw new Error('File too large. Maximum size is 5MB.')
        }

        // Generate unique filename
        const bytes = randomBytes(16).toString('hex')
        const ext = file.name.split('.').pop()
        const filename = `${bytes}.${ext}`

        // Create upload directory if it doesn't exist
        const uploadDir = join(process.cwd(), 'public', 'uploads')
        try {
            await mkdir(uploadDir, { recursive: true })
        } catch (e) {
            // Directory might already exist
        }

        // Convert file to buffer and write
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const filepath = join(uploadDir, filename)

        await writeFile(filepath, buffer)

        // Return public URL
        return `/uploads/${filename}`
    } catch (error) {
        console.error('Image upload failed:', error)
        return null
    }
}

export async function downloadImageFromUrl(url: string): Promise<string | null> {
    try {
        if (!url || !url.startsWith('http')) {
            return null
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error('URL does not point to an image')
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Generate unique filename
        const bytes = randomBytes(16).toString('hex')

        // Try to get extension from URL or content-type
        let ext = url.split('.').pop()?.split(/[?#]/)[0]?.toLowerCase()
        if (!ext || ext.length > 4 || !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
            ext = contentType.split('/').pop() || 'jpg'
            if (ext === 'jpeg') ext = 'jpg'
        }
        const filename = `${bytes}.${ext}`

        const uploadDir = join(process.cwd(), 'public', 'uploads')
        await mkdir(uploadDir, { recursive: true })

        const filepath = join(uploadDir, filename)
        await writeFile(filepath, buffer)

        return `/uploads/${filename}`
    } catch (error) {
        console.error(`Failed to download image from URL: ${url}`, error)
        return null
    }
}
