CREATE POLICY "Checklist managers can read all schedules"
ON public.schedules
FOR SELECT
USING (public.can_manage_checklists());