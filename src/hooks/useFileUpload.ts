'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/auth-client'
import { v4 as uuidv4 } from 'uuid'

type UploadResult = {
    url: string
    path: string
}

type UploadError = {
    message: string
    code?: string
}

type UseFileUploadOptions = {
    folder?: string
    onProgress?: (progress: number) => void
}

/**
 * React hook for uploading files to Supabase Storage.
 * 
 * @example
 * const { upload, isUploading, error } = useFileUpload({ folder: 'covers' })
 * const result = await upload(file)
 * console.log(result.url) // Public URL of uploaded file
 */
export function useFileUpload(options: UseFileUploadOptions = {}) {
    const [isUploading, setIsUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState<UploadError | null>(null)

    const { folder = 'uploads', onProgress } = options

    const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
        setIsUploading(true)
        setError(null)
        setProgress(0)

        try {
            // Generate unique filename
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
            const fileName = `${uuidv4()}.${fileExt}`
            const filePath = `${folder}/${fileName}`

            console.log(`[useFileUpload] Uploading to: ${filePath}`)

            // Upload to Supabase Storage
            const { data, error: uploadError } = await supabase.storage
                .from('media')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) {
                console.error('[useFileUpload] Upload error:', uploadError)
                setError({ message: uploadError.message, code: uploadError.name })
                return null
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('media')
                .getPublicUrl(data.path)

            console.log(`[useFileUpload] Upload complete: ${urlData.publicUrl}`)
            setProgress(100)
            onProgress?.(100)

            return {
                url: urlData.publicUrl,
                path: data.path
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed'
            console.error('[useFileUpload] Error:', err)
            setError({ message })
            return null
        } finally {
            setIsUploading(false)
        }
    }, [folder, onProgress])

    /**
     * Upload from a URL (downloads the image and uploads to Supabase)
     */
    const uploadFromUrl = useCallback(async (imageUrl: string): Promise<UploadResult | null> => {
        setIsUploading(true)
        setError(null)

        try {
            console.log(`[useFileUpload] Downloading from URL: ${imageUrl}`)

            // Fetch the image
            const response = await fetch(imageUrl)
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`)
            }

            const blob = await response.blob()

            // Determine file extension from content type
            const contentType = response.headers.get('content-type') || 'image/jpeg'
            const ext = contentType.includes('png') ? 'png'
                : contentType.includes('webp') ? 'webp'
                    : contentType.includes('gif') ? 'gif'
                        : 'jpg'

            const file = new File([blob], `downloaded.${ext}`, { type: contentType })

            return await upload(file)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'URL upload failed'
            console.error('[useFileUpload] URL upload error:', err)
            setError({ message })
            return null
        } finally {
            setIsUploading(false)
        }
    }, [upload])

    return {
        upload,
        uploadFromUrl,
        isUploading,
        progress,
        error
    }
}
