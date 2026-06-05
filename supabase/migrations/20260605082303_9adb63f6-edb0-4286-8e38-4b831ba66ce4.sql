ALTER TABLE public.task_categories ADD COLUMN IF NOT EXISTS is_break boolean NOT NULL DEFAULT false;

INSERT INTO public.task_categories (label, requires_note, checklist_items, sort_order, is_active, is_break)
SELECT 'Rast', false, NULL, 9, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.task_categories WHERE is_break = true);