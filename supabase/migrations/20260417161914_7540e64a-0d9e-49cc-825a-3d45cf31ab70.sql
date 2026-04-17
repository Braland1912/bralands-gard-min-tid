ALTER TABLE public.checklist_template_shift_types
ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX idx_ctst_shift_type_sort
ON public.checklist_template_shift_types(shift_type, sort_order);