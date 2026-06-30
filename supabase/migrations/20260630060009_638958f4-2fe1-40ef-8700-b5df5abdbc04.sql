
-- Grupper för checklist-mallar
CREATE TABLE public.checklist_template_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#4e8283',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_template_groups TO authenticated;
GRANT ALL ON public.checklist_template_groups TO service_role;

ALTER TABLE public.checklist_template_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view groups"
  ON public.checklist_template_groups FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Checklist managers can insert groups"
  ON public.checklist_template_groups FOR INSERT
  TO authenticated WITH CHECK (public.can_manage_checklists());

CREATE POLICY "Checklist managers can update groups"
  ON public.checklist_template_groups FOR UPDATE
  TO authenticated USING (public.can_manage_checklists())
  WITH CHECK (public.can_manage_checklists());

CREATE POLICY "Checklist managers can delete groups"
  ON public.checklist_template_groups FOR DELETE
  TO authenticated USING (public.can_manage_checklists());

CREATE TRIGGER set_updated_at_checklist_template_groups
  BEFORE UPDATE ON public.checklist_template_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Beskrivningar och gruppkoppling på mallar
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.checklist_template_groups(id) ON DELETE SET NULL;

ALTER TABLE public.checklist_template_items
  ADD COLUMN IF NOT EXISTS description text;

-- Spara grupp/beskrivning även på pass-kopian så det följer med
ALTER TABLE public.shift_checklists
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS group_color text;

ALTER TABLE public.shift_checklist_items
  ADD COLUMN IF NOT EXISTS description text;
