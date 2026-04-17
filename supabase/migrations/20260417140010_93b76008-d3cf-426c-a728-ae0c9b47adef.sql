ALTER TABLE public.shift_checklists ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
UPDATE public.shift_checklists sc SET sort_order = sub.rn - 1
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY shift_id ORDER BY created_at) AS rn FROM public.shift_checklists) sub
WHERE sc.id = sub.id;