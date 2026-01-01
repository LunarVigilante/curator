/**
 * Utility functions for optimized image URLs.
 * Used with Supabase Storage and Edge Function image optimization.
 */

type ImageSize = 'thumb' | 'medium' | 'large' | 'original'

const SIZE_SUFFIXES: Record<ImageSize, string> = {
    thumb: '_thumb',
    medium: '_medium',
    large: '_large',
    original: ''
}

/**
 * Get the optimized image URL for a specific size.
 * 
 * @param path - Original image path or URL
 * @param size - Desired size (thumb: 200px, medium: 600px, large: 1200px)
 * @returns Optimized image URL
 * 
 * @example
 * getOptimizedImageUrl('/covers/abc123.jpg', 'medium')
 * // Returns: https://your-project.supabase.co/storage/v1/object/public/media/covers/abc123_medium.webp
 */
export function getOptimizedImageUrl(path: string | null | undefined, size: ImageSize = 'medium'): string {
    if (!path) return '/images/placeholder.png'

    // If already a full Supabase URL, modify it
    if (path.includes('supabase.co/storage')) {
        if (size === 'original') return path

        // Insert size suffix before extension
        const lastDot = path.lastIndexOf('.')
        if (lastDot === -1) return path

        const basePath = path.substring(0, lastDot)
        return `${basePath}${SIZE_SUFFIXES[size]}.webp`
    }

    // If it's an external URL (TMDB, etc.), return as-is
    // These should be migrated to Supabase Storage
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path
    }

    // If it's a local path, return as-is
    if (path.startsWith('/')) {
        return path
    }

    // Assume it's a Supabase Storage path
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return path

    const basePath = path.replace(/\.[^.]+$/, '') // Remove extension
    const suffix = SIZE_SUFFIXES[size]
    const ext = size === 'original' ? path.split('.').pop() : 'webp'

    return `${supabaseUrl}/storage/v1/object/public/media/${basePath}${suffix}.${ext}`
}

/**
 * Generate srcset string for responsive images.
 * 
 * @param path - Original image path
 * @returns srcset string for use in img elements
 * 
 * @example
 * <img src={getOptimizedImageUrl(path, 'medium')} srcSet={getImageSrcSet(path)} />
 */
export function getImageSrcSet(path: string | null | undefined): string {
    if (!path) return ''

    const thumb = getOptimizedImageUrl(path, 'thumb')
    const medium = getOptimizedImageUrl(path, 'medium')
    const large = getOptimizedImageUrl(path, 'large')

    return `${thumb} 200w, ${medium} 600w, ${large} 1200w`
}

/**
 * Check if an image path is a Supabase Storage URL.
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
