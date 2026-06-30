
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS can_manage_checklists boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_manage_checklists()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.user_id = auth.uid() AND w.can_manage_checklists = true
    );
$$;

DROP POLICY IF EXISTS "Admins manage checklist templates" ON public.checklist_templates;
CREATE POLICY "Managers manage checklist templates" ON public.checklist_templates
  FOR ALL TO authenticated
  USING (public.can_manage_checklists())
  WITH CHECK (public.can_manage_checklists());

DROP POLICY IF EXISTS "Admins manage checklist template items" ON public.checklist_template_items;
CREATE POLICY "Managers manage checklist template items" ON public.checklist_template_items
  FOR ALL TO authenticated
  USING (public.can_manage_checklists())
  WITH CHECK (public.can_manage_checklists());

DROP POLICY IF EXISTS "Admins manage template shift types" ON public.checklist_template_shift_types;
CREATE POLICY "Managers manage template shift types" ON public.checklist_template_shift_types
  FOR ALL TO authenticated
  USING (public.can_manage_checklists())
  WITH CHECK (public.can_manage_checklists());

UPDATE public.workers SET can_manage_checklists = true WHERE lower(name) LIKE 'vendela%';
