-- Migration: Fix security linter warnings
-- 1. Set search_path for functions (prevents SQL injection via search_path manipulation)
-- 2. Remove SECURITY DEFINER from vibe_comparison view
-- NOTE: search_path includes 'extensions' for pgvector operators to work

-- Fix function search_path issues (include extensions for vector operators)
ALTER FUNCTION public.find_semantic_neighbors SET search_path = public, extensions;
ALTER FUNCTION public.browse_items SET search_path = public, extensions;
ALTER FUNCTION public.get_category_vibe_stats SET search_path = public, extensions;
ALTER FUNCTION public.detect_vibe_outliers SET search_path = public, extensions;
ALTER FUNCTION public.migrate_cast_batch SET search_path = public, extensions;

-- Fix security definer view by recreating without SECURITY DEFINER
-- First get the view definition, then recreate it
DO $$
DECLARE
    view_def TEXT;
BEGIN
    -- Get current view definition
    SELECT pg_get_viewdef('public.vibe_comparison', true) INTO view_def;
    
    -- Drop and recreate without security definer
    DROP VIEW IF EXISTS public.vibe_comparison;
    
    EXECUTE 'CREATE VIEW public.vibe_comparison AS ' || view_def;
END $$;

-- Ensure proper permissions
GRANT SELECT ON public.vibe_comparison TO authenticated;
GRANT SELECT ON public.vibe_comparison TO anon;
