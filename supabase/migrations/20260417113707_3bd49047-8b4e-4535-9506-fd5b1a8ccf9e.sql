-- Fix double shifts: replace unique constraint to include shift_index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedules_user_id_date_key'
  ) THEN
    ALTER TABLE public.schedules DROP CONSTRAINT schedules_user_id_date_key;
  END IF;
END $$;

-- Ensure shift_index column exists (already in schema, kept for safety)
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS shift_index integer NOT NULL DEFAULT 0;

-- Add new composite unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedules_user_id_date_shift_index_key'
  ) THEN
    ALTER TABLE public.schedules
      ADD CONSTRAINT schedules_user_id_date_shift_index_key UNIQUE (user_id, date, shift_index);
  END IF;
END $$;

-- Checklist templates
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template_id
  ON public.checklist_template_items(template_id);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read templates
CREATE POLICY "Authenticated can read checklist templates"
  ON public.checklist_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read checklist template items"
  ON public.checklist_template_items FOR SELECT TO authenticated USING (true);

-- Only admins can manage
CREATE POLICY "Admins manage checklist templates"
  ON public.checklist_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage checklist template items"
  ON public.checklist_template_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));