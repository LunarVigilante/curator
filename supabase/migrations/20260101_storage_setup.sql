-- =============================================================================
-- SUPABASE STORAGE: Media Bucket Setup
-- =============================================================================

-- Create the 'media' bucket for all file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media',
    'media',
    true, -- Public bucket for serving images
    10485760, -- 10MB file size limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- RLS POLICIES: Storage Access Control
-- =============================================================================

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

-- Allow authenticated users to update their uploads
CREATE POLICY "Users can update their uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Users can delete their uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access (for serving images)
CREATE POLICY "Public read access for media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'media');

-- Allow service role full access (for Edge Functions)
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');
