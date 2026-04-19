-- Normalisera ev. existerande dubbletter genom att lägga till suffix
WITH dups AS (
  SELECT id, name,
    ROW_NUMBER() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at) AS rn
  FROM public.checklist_templates
)
UPDATE public.checklist_templates t
SET name = t.name || ' (' || d.rn || ')'
FROM dups d
WHERE t.id = d.id AND d.rn > 1;

-- Unik constraint på namn (case-insensitive, trimmat)
CREATE UNIQUE INDEX checklist_templates_unique_name_idx
ON public.checklist_templates (lower(trim(name)));