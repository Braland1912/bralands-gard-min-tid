CREATE TABLE public.checklist_template_shift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  shift_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, shift_type)
);

CREATE INDEX idx_ctst_shift_type ON public.checklist_template_shift_types(shift_type);

ALTER TABLE public.checklist_template_shift_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read template shift types"
ON public.checklist_template_shift_types FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins manage template shift types"
ON public.checklist_template_shift_types FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));