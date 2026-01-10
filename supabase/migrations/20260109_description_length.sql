-- Computed Column: description_length
-- Allows PostgREST filtering like: update?description_length=lt.50

CREATE OR REPLACE FUNCTION description_length(row global_items)
RETURNS integer AS $$
  SELECT char_length(COALESCE(row.description, ''));
$$ LANGUAGE sql IMMUTABLE;
