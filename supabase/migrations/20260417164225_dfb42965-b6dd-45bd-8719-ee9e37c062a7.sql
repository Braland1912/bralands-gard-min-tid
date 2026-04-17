ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Initialize sort_order based on existing created_at order (newest first = 0)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn
  FROM public.checklist_templates
)
UPDATE public.checklist_templates t
SET sort_order = r.rn
FROM ranked r
WHERE t.id = r.id;