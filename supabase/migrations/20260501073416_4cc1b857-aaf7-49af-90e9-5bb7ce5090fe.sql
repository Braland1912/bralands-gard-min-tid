-- Tabell för kvällsrundans redovisning (checklista + kassa)
CREATE TABLE public.evening_round_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evening_round_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  checklist jsonb NOT NULL DEFAULT '{
    "cool_boxes": false,
    "drain_locks": false,
    "dryer_service": false,
    "dryer_laundry": false,
    "laundry_check": false
  }'::jsonb,
  cash_breakdown jsonb NOT NULL DEFAULT '{
    "kiosk": 0,
    "ved": 0,
    "tvattmaskin": 0,
    "torktumlare": 0,
    "other": 0
  }'::jsonb,
  notes text,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evening_round_id, worker_id)
);

CREATE INDEX idx_evening_round_summaries_round ON public.evening_round_summaries(evening_round_id);
CREATE INDEX idx_evening_round_summaries_worker ON public.evening_round_summaries(worker_id);

ALTER TABLE public.evening_round_summaries ENABLE ROW LEVEL SECURITY;

-- Admin: full åtkomst
CREATE POLICY "Admins manage summaries"
ON public.evening_round_summaries
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Medarbetare: läs alla (för historik/insyn i samma teamet)
CREATE POLICY "Authenticated can view summaries"
ON public.evening_round_summaries
FOR SELECT
TO authenticated
USING (true);

-- Medarbetare: insert egna
CREATE POLICY "Workers insert own summaries"
ON public.evening_round_summaries
FOR INSERT
TO authenticated
WITH CHECK (is_my_worker(worker_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Medarbetare: update egna
CREATE POLICY "Workers update own summaries"
ON public.evening_round_summaries
FOR UPDATE
TO authenticated
USING (is_my_worker(worker_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (is_my_worker(worker_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger för updated_at
CREATE TRIGGER trg_evening_round_summaries_updated_at
BEFORE UPDATE ON public.evening_round_summaries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.evening_round_summaries;