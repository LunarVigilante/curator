-- Fix HTML entities in existing titles
-- Run this in Supabase SQL Editor

-- Preview what will be fixed
SELECT id, title, 
       REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           title, 
           '&#039;', ''''),
           '&amp;', '&'),
           '&quot;', '"'),
           '&#39;', ''''),
           '&apos;', ''''),
           '&#x27;', '''') AS fixed_title
FROM global_items
WHERE title LIKE '%&#%' OR title LIKE '%&amp;%' OR title LIKE '%&quot;%';

-- Apply the fix
UPDATE global_items
SET title = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    title, 
    '&#039;', ''''),
    '&amp;', '&'),
    '&quot;', '"'),
    '&#39;', ''''),
    '&apos;', ''''),
    '&#x27;', ''''),
    '&lt;', '<'),
    '&gt;', '>'),
    '&ndash;', '–'),
    '&mdash;', '—'),
    '&hellip;', '…'),
    '&nbsp;', ' ')
WHERE title LIKE '%&#%' 
   OR title LIKE '%&amp;%' 
   OR title LIKE '%&quot;%'
   OR title LIKE '%&lt;%'
   OR title LIKE '%&gt;%'
   OR title LIKE '%&ndash;%'
   OR title LIKE '%&mdash;%'
   OR title LIKE '%&hellip;%'
   OR title LIKE '%&nbsp;%';

-- Also fix descriptions
UPDATE global_items
SET description = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    description, 
    '&#039;', ''''),
    '&amp;', '&'),
    '&quot;', '"'),
    '&#39;', ''''),
    '&apos;', ''''),
    '&#x27;', ''''),
    '&lt;', '<'),
    '&gt;', '>'),
    '&ndash;', '–'),
    '&mdash;', '—'),
    '&hellip;', '…'),
    '&nbsp;', ' ')
WHERE description LIKE '%&#%' 
   OR description LIKE '%&amp;%' 
   OR description LIKE '%&quot;%'
   OR description LIKE '%&lt;%'
   OR description LIKE '%&gt;%';
