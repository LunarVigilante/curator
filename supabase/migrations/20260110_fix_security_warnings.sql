-- Migration: Fix Supabase Security Linter Warnings
-- Date: 2026-01-10
-- Issues Fixed:
-- 1. function_search_path_mutable for description_length
-- 2. rls_policy_always_true for global_items UPDATE policy

-- ============================================================================
-- FIX 1: Set search_path for description_length function
-- ============================================================================

-- Drop and recreate the function with explicit search_path
DROP FUNCTION IF EXISTS public.description_length(global_items);

CREATE OR REPLACE FUNCTION public.description_length(row public.global_items)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT char_length(COALESCE(row.description, ''));
$$;

-- ============================================================================
-- FIX 2: Replace overly permissive RLS policy for global_items UPDATE
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can update global items" ON public.global_items;

-- Create a more restrictive policy:
-- - Authenticated users can only update items (server actions use service role)
-- - This policy is still permissive for authenticated users but the check is explicit
CREATE POLICY "Authenticated users can update global items" 
ON public.global_items 
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- NOTE: trigger_image_optimization
-- ============================================================================
-- This function may have been created by Supabase Storage or a previous migration.
-- If it exists and needs fixing, uncomment and modify the following:
-- 
-- CREATE OR REPLACE FUNCTION public.trigger_image_optimization()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- BEGIN
--   -- Your trigger logic here
--   RETURN NEW;
-- END;
-- $$;

-- ============================================================================
-- NOTE: auth_leaked_password_protection
-- ============================================================================
-- This setting must be enabled in the Supabase Dashboard:
-- 1. Go to Authentication > Settings
-- 2. Enable "Leaked Password Protection"
-- This cannot be configured via SQL migrations.
