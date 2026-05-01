-- Logg-tabell för checklista per arbetspass
CREATE TABLE public.shift_checklist_completion_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_item_id UUID NOT NULL,
  shift_checklist_id UUID NOT NULL,
  shift_id UUID NOT NULL,
  shift_date DATE NOT NULL,
  worker_user_id UUID NOT NULL,
  is_checked BOOLEAN NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_sccl_shift_date ON public.shift_checklist_completion_log (shift_date);
CREATE INDEX idx_sccl_shift_id ON public.shift_checklist_completion_log (shift_id);
CREATE INDEX idx_sccl_item ON public.shift_checklist_completion_log (checklist_item_id);
CREATE INDEX idx_sccl_worker ON public.shift_checklist_completion_log (worker_user_id);

ALTER TABLE public.shift_checklist_completion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read completion log"
  ON public.shift_checklist_completion_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Workers log completions for own shifts"
  ON public.shift_checklist_completion_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    worker_user_id = auth.uid()
    AND shift_id IN (SELECT id FROM public.schedules WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins manage completion log"
  ON public.shift_checklist_completion_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));