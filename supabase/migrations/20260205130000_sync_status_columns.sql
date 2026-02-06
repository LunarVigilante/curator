-- v4.7: Sync Status Integration for Cleanup Harvests
-- Enables targeted retry of failed embedding operations

ALTER TABLE global_items ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending';
ALTER TABLE global_items ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Partial index for efficient "failed items" queries
CREATE INDEX IF NOT EXISTS idx_global_items_sync_status_failed 
ON global_items (sync_status) 
WHERE sync_status = 'failed';

COMMENT ON COLUMN global_items.sync_status IS 'Embedding sync status: pending, synced, failed';
COMMENT ON COLUMN global_items.sync_error IS 'Error code from batch-embedding: RATE_LIMITED, TOKEN_LIMIT, etc.';
