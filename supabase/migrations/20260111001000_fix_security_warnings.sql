-- Fix function_search_path_mutable warning
-- Signature from 20260110_add_filter_values_rpc.sql: (text, text, text, int)
ALTER FUNCTION public.get_filter_values(text, text, text, integer) SET search_path = public;

-- Fix rls_enabled_no_policy warnings
-- 1. activities
CREATE POLICY "Service role manages activities" ON public.activities FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view own activities" ON public.activities FOR SELECT USING (auth.uid() = user_id);

-- 2. cohort_averages
CREATE POLICY "Service role manages cohort_averages" ON public.cohort_averages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated view cohort_averages" ON public.cohort_averages FOR SELECT TO authenticated USING (true);

-- 3. collection_comments
CREATE POLICY "Service role manages comments" ON public.collection_comments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view comments" ON public.collection_comments FOR SELECT USING (true);
CREATE POLICY "Users manage own comments" ON public.collection_comments FOR ALL USING (auth.uid() = user_id);

-- 4. collection_likes
CREATE POLICY "Service role manages likes" ON public.collection_likes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view likes" ON public.collection_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own likes" ON public.collection_likes FOR ALL USING (auth.uid() = user_id);

-- 5. collection_saves
CREATE POLICY "Service role manages saves" ON public.collection_saves FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users manage own saves" ON public.collection_saves FOR ALL USING (auth.uid() = user_id);

-- 6. collection_tags
CREATE POLICY "Service role manages collection_tags" ON public.collection_tags FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view collection_tags" ON public.collection_tags FOR SELECT USING (true);

-- 7. curator_notes
CREATE POLICY "Service role manages notes" ON public.curator_notes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users manage own notes" ON public.curator_notes FOR ALL USING (auth.uid() = user_id);

-- 8. custom_ranks
CREATE POLICY "Service role manages custom_ranks" ON public.custom_ranks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view custom_ranks" ON public.custom_ranks FOR SELECT USING (true);

-- 9. email_templates
CREATE POLICY "Service role manages email_templates" ON public.email_templates FOR ALL USING (auth.role() = 'service_role');

-- 10. follows
CREATE POLICY "Service role manages follows" ON public.follows FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- 11. insight_unlocks
CREATE POLICY "Service role manages insight_unlocks" ON public.insight_unlocks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view own unlocks" ON public.insight_unlocks FOR SELECT USING (auth.uid() = user_id);

-- 12. items_to_tags
CREATE POLICY "Service role manages items_to_tags" ON public.items_to_tags FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view items_to_tags" ON public.items_to_tags FOR SELECT USING (true);

-- 13. share_cards
CREATE POLICY "Service role manages share_cards" ON public.share_cards FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public view share_cards" ON public.share_cards FOR SELECT USING (true);
CREATE POLICY "Users manage own share_cards" ON public.share_cards FOR ALL USING (auth.uid() = user_id);

-- 14. taste_metrics
CREATE POLICY "Service role manages taste_metrics" ON public.taste_metrics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view own metrics" ON public.taste_metrics FOR SELECT USING (auth.uid() = user_id);

-- 15. taste_snapshots
CREATE POLICY "Service role manages taste_snapshots" ON public.taste_snapshots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view own snapshots" ON public.taste_snapshots FOR SELECT USING (auth.uid() = user_id);

-- 16. unlock_conditions
CREATE POLICY "Service role manages unlock_conditions" ON public.unlock_conditions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated view unlock_conditions" ON public.unlock_conditions FOR SELECT TO authenticated USING (true);

-- 17. user_challenges
CREATE POLICY "Service role manages user_challenges" ON public.user_challenges FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view own challenges" ON public.user_challenges FOR SELECT USING (auth.uid() = user_id);

-- 18. user_top_picks
CREATE POLICY "Service role manages user_top_picks" ON public.user_top_picks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users view top_picks" ON public.user_top_picks FOR SELECT USING (true);
CREATE POLICY "Users manage own top_picks" ON public.user_top_picks FOR ALL USING (auth.uid() = user_id);
