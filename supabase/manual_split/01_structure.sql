-- PART 1: STRUCTURE
-- Run this first. It enables the extension and adds the column.

-- 1. Enable pgvector (creates in extensions schema by default on Supabase)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Add embedding column (use vector type without schema prefix after extension is created)
ALTER TABLE public.global_items
ADD COLUMN IF NOT EXISTS embedding vector(1024);
