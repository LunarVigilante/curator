-- ============================================================================
-- AUDIT LOGS TABLE
-- For CCPA compliance - tracks access, modification, and deletion of user data
-- ============================================================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,          -- 'DATA_ACCESS', 'DATA_MODIFY', 'DATA_DELETE', 'ADMIN_ACTION', etc.
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- User performing the action
    target_id UUID,                     -- User being accessed/modified (null for system actions)
    resource_type TEXT NOT NULL,        -- 'profile', 'items', 'categories', etc.
    resource_id UUID,                   -- Specific resource ID
    action TEXT NOT NULL,               -- 'read', 'update', 'delete', 'export', etc.
    metadata JSONB,                     -- Additional context
    ip_address INET,                    -- Optional, for security events only
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for compliance queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_id, event_type);

-- RLS: Only service role can access audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role can access audit logs" ON audit_logs;

-- Create policy for service role access
CREATE POLICY "Service role can access audit logs" ON audit_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- RETENTION TRACKING: Add last_activity to profiles
-- ============================================================================

-- Add last_activity column for retention tracking
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();

-- Create index for retention queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_activity ON profiles(last_activity);

-- Function to update last_activity on user actions
CREATE OR REPLACE FUNCTION update_user_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update the user's last_activity timestamp
    UPDATE profiles 
    SET last_activity = NOW() 
    WHERE id = auth.uid();
    RETURN NULL;
END;
$$;

-- Create triggers to update last_activity on key actions
-- Trigger on items insert/update
DROP TRIGGER IF EXISTS items_update_last_activity ON items;
CREATE TRIGGER items_update_last_activity
    AFTER INSERT OR UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_user_last_activity();

-- Trigger on ratings insert/update
DROP TRIGGER IF EXISTS ratings_update_last_activity ON ratings;
CREATE TRIGGER ratings_update_last_activity
    AFTER INSERT OR UPDATE ON ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_last_activity();

-- Trigger on categories insert/update
DROP TRIGGER IF EXISTS categories_update_last_activity ON categories;
CREATE TRIGGER categories_update_last_activity
    AFTER INSERT OR UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_user_last_activity();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Service role needs full access for audit logging
GRANT ALL ON audit_logs TO service_role;

-- Regular users cannot access audit logs directly
REVOKE ALL ON audit_logs FROM authenticated;
REVOKE ALL ON audit_logs FROM anon;
