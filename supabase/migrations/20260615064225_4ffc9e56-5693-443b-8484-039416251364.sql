CREATE TABLE public.evening_round_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_date date NOT NULL,
  evening_round_id uuid REFERENCES public.evening_rounds(id) ON DELETE SET NULL,
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  worker_name text,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  summary text NOT NULL,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX evening_round_activity_log_date_idx
  ON public.evening_round_activity_log (round_date DESC, created_at DESC);
CREATE INDEX evening_round_activity_log_round_idx
  ON public.evening_round_activity_log (evening_round_id);

GRANT SELECT, INSERT ON public.evening_round_activity_log TO authenticated;
GRANT ALL ON public.evening_round_activity_log TO service_role;

ALTER TABLE public.evening_round_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read activity log"
  ON public.evening_round_activity_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Workers can insert own activity"
  ON public.evening_round_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    worker_id IS NULL
    OR public.is_my_worker(worker_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );