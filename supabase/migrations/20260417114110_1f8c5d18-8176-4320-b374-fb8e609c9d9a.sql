CREATE TABLE IF NOT EXISTS public.shift_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shift_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_checklist_id uuid NOT NULL REFERENCES public.shift_checklists(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_checklists_shift_id ON public.shift_checklists(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_checklist_items_list_id ON public.shift_checklist_items(shift_checklist_id);

ALTER TABLE public.shift_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_checklist_items ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users can read all (workers need to see their shift's lists)
CREATE POLICY "Authenticated can read shift checklists"
  ON public.shift_checklists FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read shift checklist items"
  ON public.shift_checklist_items FOR SELECT TO authenticated USING (true);

-- Admins manage shift_checklists fully
CREATE POLICY "Admins manage shift checklists"
  ON public.shift_checklists FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins manage shift_checklist_items fully
CREATE POLICY "Admins manage shift checklist items"
  ON public.shift_checklist_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Workers can update is_checked on items belonging to their own shift
CREATE POLICY "Workers can check items on own shifts"
  ON public.shift_checklist_items FOR UPDATE TO authenticated
  USING (
    shift_checklist_id IN (
      SELECT sc.id FROM public.shift_checklists sc
      JOIN public.schedules s ON s.id = sc.shift_id
      WHERE s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    shift_checklist_id IN (
      SELECT sc.id FROM public.shift_checklists sc
      JOIN public.schedules s ON s.id = sc.shift_id
      WHERE s.user_id = auth.uid()
    )
  );