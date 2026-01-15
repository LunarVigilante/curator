-- PART 2: INDEXING
-- Run this second, AFTER 01_structure.sql has completed successfully.
-- WARNING: This step might take a while if you have many items.

CREATE INDEX IF NOT EXISTS global_items_embedding_hnsw_idx
ON public.global_items
USING hnsw (embedding vector_cosine_ops);
