import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { nanoid } from 'nanoid';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

/**
 * Service to handle image processing and storage.
 * - Downloads images from external URLs
 * - Resizes and optimizes (WebP)
 * - Uploads to Supabase Storage
 */
export class ImageService {
    private supabase = createServiceRoleClient();
    private bucket: string;

    constructor(bucket: string = 'images') {
        this.bucket = bucket;
    }

    /**
     * Process an image URL: download, optimize, upload to Supabase.
     * Returns the new Supabase Storage public URL.
     * If processing fails, returns null (or throws if strict).
     */
    async processAndUpload(url: string, prefix: 'anime' | 'game' | 'movie' | 'book' | 'misc' = 'misc'): Promise<string | null> {
        if (!url || url.startsWith('http://localhost') || url.includes('supabase.co')) {
            // Already local or invalid
            return url;
        }

        try {
            console.log(`[ImageService] Processing: ${url}`);

            // 1. Download image
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[ImageService] Failed to fetch image: ${response.statusText}`);
                return null;
            }
            const buffer = await response.arrayBuffer();

            // 2. Optimize with Sharp
            // - Resize: max width 1200px, preserve aspect
            // - Format: WebP, quality 80
            const processedBuffer = await sharp(Buffer.from(buffer))
                .resize({ width: 1200, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer();

            // 3. Upload to Supabase
            // Path: {prefix}/{randomId}.webp
            const fileName = `${prefix}/${nanoid()}.webp`;

            const { error: uploadError } = await this.supabase.storage
                .from(this.bucket)
                .upload(fileName, processedBuffer, {
                    contentType: 'image/webp',
                    upsert: false
                });

            if (uploadError) {
                console.error('[ImageService] Upload error:', uploadError);
                return null;
            }

            // 4. Get Public URL
            const { data: { publicUrl } } = this.supabase.storage
                .from(this.bucket)
                .getPublicUrl(fileName);

            console.log(`[ImageService] Uploaded to: ${publicUrl}`);
            return publicUrl;

        } catch (error) {
            console.error('[ImageService] Error processing image:', error);
            return null;
        }
    }

    /**
     * Delete an image from storage
     */
    async deleteImage(path: string) {
        if (!path.includes(this.bucket)) return;

        // Extract path from URL roughly
        // ...implementation depends on URL structure...
        // For now, simple return as we generally don't delete historical data often
    }
}
