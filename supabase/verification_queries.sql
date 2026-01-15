-- ============================================================================
-- MANUAL VERIFICATION SCRIPT
-- Run this in your Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Check for Vector Column on global_items
SELECT 'global_items has embedding' as check_name, 
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_items' AND column_name = 'embedding') as passed;

-- 2. Check for TOPSIS Tables
SELECT 'criteria_definitions exists' as check_name, 
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'criteria_definitions') as passed
UNION ALL
SELECT 'user_criteria_ratings exists' as check_name, 
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_criteria_ratings') as passed;

-- 3. Check for Ranking RPCs
SELECT 'get_borda_rankings exists' as check_name, 
       EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_borda_rankings') as passed
UNION ALL
SELECT 'get_topsis_rankings exists' as check_name, 
       EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_topsis_rankings') as passed
UNION ALL
SELECT 'match_documents exists' as check_name, 
       EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'match_documents') as passed;

-- ============================================================================
-- INSTRUCTIONS:
-- If all 'passed' columns are TRUE, Phase 1 is complete.
-- If 'get_borda_rankings' or TOPSIS tables are FALSE, run the migration file:
-- supabase/migrations/20260113171100_phase_1_vector_search.sql
-- ============================================================================
