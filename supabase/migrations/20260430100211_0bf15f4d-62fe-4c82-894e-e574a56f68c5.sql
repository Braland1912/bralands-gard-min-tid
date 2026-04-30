-- Add columns to evening_round_guests
ALTER TABLE public.evening_round_guests
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS nationality text;

-- Create evening_round_sessions table
CREATE TABLE IF NOT EXISTS public.evening_round_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  round_date date NOT NULL,
  session_start timestamptz,
  session_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, round_date)
);

ALTER TABLE public.evening_round_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers view own sessions"
ON public.evening_round_sessions
FOR SELECT TO authenticated
USING (public.is_my_worker(worker_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers insert own sessions"
ON public.evening_round_sessions
FOR INSERT TO authenticated
WITH CHECK (public.is_my_worker(worker_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers update own sessions"
ON public.evening_round_sessions
FOR UPDATE TO authenticated
USING (public.is_my_worker(worker_id) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.is_my_worker(worker_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage sessions"
ON public.evening_round_sessions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_evening_round_sessions_updated_at
BEFORE UPDATE ON public.evening_round_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_evening_round_sessions_worker_date
  ON public.evening_round_sessions (worker_id, round_date);