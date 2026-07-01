
-- 1. Merge is_checked=true from duplicate items into the keeper list (matching by text)
WITH ranked AS (
  SELECT id, shift_id, name,
    ROW_NUMBER() OVER (PARTITION BY shift_id, name ORDER BY created_at ASC, id ASC) AS rn
  FROM public.shift_checklists
),
keepers AS (SELECT id, shift_id, name FROM ranked WHERE rn = 1),
dups AS (SELECT id, shift_id, name FROM ranked WHERE rn > 1),
checked_texts AS (
  SELECT DISTINCT k.id AS keeper_id, i.text
  FROM dups d
  JOIN keepers k ON k.shift_id = d.shift_id AND k.name = d.name
  JOIN public.shift_checklist_items i ON i.shift_checklist_id = d.id
  WHERE i.is_checked = true
)
UPDATE public.shift_checklist_items ki
SET is_checked = true
FROM checked_texts ct
WHERE ki.shift_checklist_id = ct.keeper_id
  AND ki.text = ct.text
  AND ki.is_checked = false;

-- 2. Delete duplicate shift_checklists (cascades to items)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY shift_id, name ORDER BY created_at ASC, id ASC) AS rn
  FROM public.shift_checklists
)
DELETE FROM public.shift_checklists
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. Prevent future duplicates
ALTER TABLE public.shift_checklists
  ADD CONSTRAINT shift_checklists_shift_name_unique UNIQUE (shift_id, name);
