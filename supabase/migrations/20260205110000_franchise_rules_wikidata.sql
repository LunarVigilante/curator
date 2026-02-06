-- =============================================================================
-- v4.3: Wikidata SSOT Migration
-- Add 'wikidata' rule_type and move hardcoded Q-IDs to franchise_rules
-- =============================================================================

-- Add 'wikidata' to allowed rule_type values
ALTER TABLE franchise_rules DROP CONSTRAINT IF EXISTS franchise_rules_rule_type_check;
ALTER TABLE franchise_rules ADD CONSTRAINT franchise_rules_rule_type_check 
    CHECK (rule_type = ANY (ARRAY['keyword', 'spinoff', 'official_list', 'wikidata']));

-- Insert Wikidata Q-ID rules
INSERT INTO franchise_rules (rule_type, source_identifier, target_universe_slug, confidence, notes)
VALUES
    ('wikidata', 'Q23880962', 'arrowverse', 1.0, 'Arrowverse (CW DC shows)'),
    ('wikidata', 'Q3138418', 'star-trek', 1.0, 'Star Trek franchise'),
    ('wikidata', 'Q25191', 'walking-dead', 1.0, 'The Walking Dead franchise'),
    ('wikidata', 'Q116054', 'game-of-thrones', 1.0, 'A Song of Ice and Fire / Game of Thrones'),
    ('wikidata', 'Q18152564', 'breaking-bad', 1.0, 'Breaking Bad franchise'),
    ('wikidata', 'Q108988194', 'yellowstone-verse', 1.0, 'Yellowstone / Taylor Sheridan universe'),
    ('wikidata', 'Q58035048', 'chicago-verse', 1.0, 'Chicago franchise (Dick Wolf)')
ON CONFLICT DO NOTHING;
