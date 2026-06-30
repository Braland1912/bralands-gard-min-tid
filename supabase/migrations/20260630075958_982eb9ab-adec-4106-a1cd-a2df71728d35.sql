
-- 1. Add lodge_unit to groups
ALTER TABLE public.checklist_template_groups
  ADD COLUMN IF NOT EXISTS lodge_unit text;

-- 2. New join table for group-level shift type links
CREATE TABLE IF NOT EXISTS public.checklist_group_shift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.checklist_template_groups(id) ON DELETE CASCADE,
  shift_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, shift_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_group_shift_types TO authenticated;
GRANT ALL ON public.checklist_group_shift_types TO service_role;

ALTER TABLE public.checklist_group_shift_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read group shift types"
  ON public.checklist_group_shift_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Checklist managers can manage group shift types"
  ON public.checklist_group_shift_types FOR ALL
  TO authenticated
  USING (public.can_manage_checklists())
  WITH CHECK (public.can_manage_checklists());

CREATE INDEX IF NOT EXISTS idx_checklist_group_shift_types_group ON public.checklist_group_shift_types(group_id);
CREATE INDEX IF NOT EXISTS idx_checklist_group_shift_types_type ON public.checklist_group_shift_types(shift_type);
