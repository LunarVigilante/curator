-- Create similarity_explanations table for caching LLM-generated explanations
-- This table stores natural language explanations of why items are similar

CREATE TABLE IF NOT EXISTS public.similarity_explanations (
    source_item_id uuid NOT NULL REFERENCES public.global_items(id) ON DELETE CASCADE,
    similar_item_id uuid NOT NULL REFERENCES public.global_items(id) ON DELETE CASCADE,
    commonalities text NOT NULL,
    differences text,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (source_item_id, similar_item_id)
);

-- Index for efficient lookups by source item
CREATE INDEX IF NOT EXISTS idx_similarity_explanations_source 
    ON public.similarity_explanations(source_item_id);

-- Index for reverse lookups (finding which items reference a given similar item)
CREATE INDEX IF NOT EXISTS idx_similarity_explanations_similar 
    ON public.similarity_explanations(similar_item_id);

-- Enable RLS
ALTER TABLE public.similarity_explanations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read explanations
CREATE POLICY "Authenticated users can read similarity explanations"
    ON public.similarity_explanations
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role to manage explanations (for caching via server actions)
CREATE POLICY "Service role can manage similarity explanations"
    ON public.similarity_explanations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant access
GRANT SELECT ON public.similarity_explanations TO authenticated;
GRANT ALL ON public.similarity_explanations TO service_role;

COMMENT ON TABLE public.similarity_explanations IS 'Cache for LLM-generated similarity explanations between items';
COMMENT ON COLUMN public.similarity_explanations.commonalities IS 'Natural language explanation of shared themes, tones, or appeal';
COMMENT ON COLUMN public.similarity_explanations.differences IS 'Optional note on key differences between items';
