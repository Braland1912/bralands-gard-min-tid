CREATE POLICY "Checklist managers can manage shift checklists"
  ON public.shift_checklists
  FOR ALL
  TO authenticated
  USING (public.can_manage_checklists())
  WITH CHECK (public.can_manage_checklists());

CREATE POLICY "Checklist managers can manage shift checklist items"
  ON public.shift_checklist_items
  FOR ALL
  TO authenticated
  USING (public.can_manage_checklists())
  WITH CHECK (public.can_manage_checklists());