-- =============================================================================
-- SUPABASE: Storage Webhook Trigger for Image Optimization
-- =============================================================================
-- This creates a database webhook that fires the Edge Function
-- when new images are uploaded to storage.

-- Note: Supabase webhooks are configured in the dashboard, not SQL.
-- This file documents the webhook configuration needed.

/*
WEBHOOK CONFIGURATION (Configure in Supabase Dashboard > Database > Webhooks)

1. Name: optimize-image-on-upload
2. Table: storage.objects
3. Events: INSERT
4. Type: Supabase Edge Function
5. Edge Function: optimize-image
6. HTTP Headers: 
   - Content-Type: application/json

Filter (optional - only trigger for specific buckets):
bucket_id = 'media'

*/

-- Alternative: Use a database trigger + pg_net extension for webhooks
-- This requires the pg_net extension to be enabled

-- Enable pg_net extension (if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to call Edge Function
CREATE OR REPLACE FUNCTION trigger_image_optimization()
RETURNS TRIGGER AS $$
DECLARE
    edge_function_url TEXT;
    payload JSONB;
BEGIN
    -- Only process image files in the media bucket
    IF NEW.bucket_id != 'media' THEN
        RETURN NEW;
    END IF;
    
    -- Skip if already an optimized variant
    IF NEW.name LIKE '%_thumb.%' OR NEW.name LIKE '%_medium.%' OR NEW.name LIKE '%_large.%' THEN
        RETURN NEW;
    END IF;
    
    -- Build payload
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'objects',
        'schema', 'storage',
        'record', jsonb_build_object(
            'id', NEW.id,
            'bucket_id', NEW.bucket_id,
            'name', NEW.name,
            'owner', NEW.owner,
            'created_at', NEW.created_at,
            'metadata', NEW.metadata
        )
    );
    
    -- Get Supabase URL from environment (set in project settings)
    edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/optimize-image';
    
    -- Call Edge Function asynchronously using pg_net
    -- Note: This requires pg_net extension
    /*
    PERFORM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := payload
    );
    */
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (uncomment when ready to use)
/*
DROP TRIGGER IF EXISTS on_storage_object_created ON storage.objects;
CREATE TRIGGER on_storage_object_created
    AFTER INSERT ON storage.objects
    FOR EACH ROW
    EXECUTE FUNCTION trigger_image_optimization();
*/

-- Note: For production, it's recommended to use Supabase Dashboard webhooks
-- instead of database triggers, as they're more reliable and easier to manage.
