-- Enable pg_trgm extension for fast ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index on title for fast pattern matching
CREATE INDEX IF NOT EXISTS idx_global_items_title_trgm 
ON global_items USING GIN (title gin_trgm_ops);

-- Create index on category_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_global_items_category_type 
ON global_items (category_type);

-- Create index for common sort fields
CREATE INDEX IF NOT EXISTS idx_global_items_last_metadata_update 
ON global_items (last_metadata_update DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_global_items_created_at 
ON global_items (created_at DESC NULLS LAST);

-- Composite index for common filter + sort pattern
CREATE INDEX IF NOT EXISTS idx_global_items_category_updated 
ON global_items (category_type, last_metadata_update DESC NULLS LAST);
