/**
 * Utility functions for optimized image URLs.
 * Uses Supabase Storage's built-in Image Transformations.
 * 
 * Enable in Dashboard: Storage → Settings → Image Transformations
 */

type ImageSize = 'thumb' | 'medium' | 'large' | 'original'

const SIZE_CONFIG: Record<ImageSize, { width: number; quality?: number }> = {
    thumb: { width: 200, quality: 75 },
    medium: { width: 600, quality: 80 },
    large: { width: 1200, quality: 85 },
    original: { width: 0 } // No transformation
}

/**
 * Get an optimized image URL using Supabase's built-in Image Transformations.
 * 
 * @param url - Original image URL (must be a Supabase Storage URL)
 * @param size - Desired size (thumb: 200px, medium: 600px, large: 1200px)
 * @returns Transformed image URL
 * 
 * @example
 * getOptimizedImageUrl('https://xxx.supabase.co/storage/v1/object/public/media/covers/abc.jpg', 'medium')
 * // Returns: https://xxx.supabase.co/storage/v1/render/image/public/media/covers/abc.jpg?width=600&quality=80
 */
export function getOptimizedImageUrl(url: string | null | undefined, size: ImageSize = 'medium'): string {
    if (!url) return '/images/placeholder.png'

    // If not a Supabase URL, return as-is
    if (!url.includes('supabase.co/storage')) {
        return url
    }

    // For original size, return as-is
    if (size === 'original') return url

    const config = SIZE_CONFIG[size]

    // Convert from /object/ to /render/image/ for transformations
    // From: /storage/v1/object/public/media/...
    // To:   /storage/v1/render/image/public/media/...?width=600
    const transformUrl = url.replace(
        '/storage/v1/object/',
        '/storage/v1/render/image/'
    )

    const params = new URLSearchParams()
    params.set('width', config.width.toString())
    if (config.quality) params.set('quality', config.quality.toString())

    return `${transformUrl}?${params.toString()}`
}

/**
 * Generate srcset string for responsive images.
 * 
 * @param url - Original image URL
 * @returns srcset string for use in img elements
 */
export function getImageSrcSet(url: string | null | undefined): string {
    if (!url || !url.includes('supabase.co/storage')) return ''

    const thumb = getOptimizedImageUrl(url, 'thumb')
    const medium = getOptimizedImageUrl(url, 'medium')
    const large = getOptimizedImageUrl(url, 'large')

    return `${thumb} 200w, ${medium} 600w, ${large} 1200w`
}

/**
 * Check if an image URL is from Supabase Storage.
 */
export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
    if (!url) return false
    return url.includes('supabase.co/storage')
}

/**
 * Check if an image needs to be migrated to Supabase Storage.
 */
export function needsMigration(url: string | null | undefined): boolean {
    if (!url) return false

    // External URLs need migration
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return !isSupabaseStorageUrl(url)
    }

    // Local paths need migration
    if (url.startsWith('/uploads/') || url.startsWith('/images/')) {
        return true
    }

    return false
}
