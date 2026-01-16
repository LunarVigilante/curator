-- Report Feature: Create reports and notifications tables
-- Migration: 20260115011500_create_report_tables.sql

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE report_reason AS ENUM ('inaccurate_data', 'duplicate', 'inappropriate', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'resolved', 'dismissed');
CREATE TYPE notification_type AS ENUM ('admin_report_alert', 'user_follow', 'item_update', 'report_resolved');

-- ============================================================================
-- REPORTS TABLE
-- ============================================================================

CREATE TABLE reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    global_item_id uuid REFERENCES global_items(id) ON DELETE CASCADE NOT NULL,
    reason report_reason NOT NULL,
    details text,
    status report_status DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    resolution_notes text
);

-- Indexes for reports
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_item ON reports(global_item_id);
CREATE INDEX idx_reports_created ON reports(created_at DESC);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type notification_type NOT NULL,
    is_read boolean DEFAULT false,
    reference_id uuid,
    reference_type text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Index for fast notification queries
CREATE INDEX idx_notifications_recipient_unread ON notifications(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Reports: Users can create and view their own reports
CREATE POLICY "Users can create reports"
    ON reports FOR INSERT
    TO authenticated
    WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can view their own reports"
    ON reports FOR SELECT
    TO authenticated
    USING (reporter_id = auth.uid());

-- Reports: Admins can view and manage all reports
CREATE POLICY "Admins can view all reports"
    ON reports FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can update reports"
    ON reports FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Notifications: Users can only access their own notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    TO authenticated
    USING (recipient_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid());

-- System can insert notifications (via service role)
CREATE POLICY "Service can create notifications"
    ON notifications FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Authenticated users can also insert notifications for triggering alerts
CREATE POLICY "Users can create notifications"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);
