ALTER TABLE public.checklist_group_shift_types
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.checklist_group_shift_types gst
SET sort_order = sub.rn - 1
FROM (
  SELECT gst2.id, ROW_NUMBER() OVER (PARTITION BY gst2.shift_type ORDER BY g.sort_order, g.name) AS rn
  FROM public.checklist_group_shift_types gst2
  JOIN public.checklist_template_groups g ON g.id = gst2.group_id
) sub
WHERE gst.id = sub.id;