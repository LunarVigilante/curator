-- v5.0: Sync Recovery CRON Setup
-- Run this in Supabase Dashboard > SQL Editor to enable pg_cron scheduling
-- 
-- PREREQUISITE: Enable pg_cron extension in Dashboard > Database > Extensions

-- Step 1: Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Step 3: Schedule the sync recovery sweep (daily at 3 AM UTC)
SELECT cron.schedule(
    'sync-recovery-sweep',  -- job name (unique identifier)
    '0 3 * * *',            -- cron expression: daily at 3 AM UTC
    $$SELECT sync_recovery_sweep()$$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('sync-recovery-sweep');

-- To run manually (for testing):
-- SELECT * FROM sync_recovery_sweep();
