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
