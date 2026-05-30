
-- Versionshistorik
CREATE TABLE public.app_releases (
  version text PRIMARY KEY,
  notes text,
  released_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view releases"
  ON public.app_releases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert releases"
  ON public.app_releases FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins manage releases"
  ON public.app_releases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));


-- Per-medarbetar versionsstatus
CREATE TABLE public.worker_app_status (
  worker_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  worker_name text NOT NULL,
  running_version text,
  latest_seen_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.worker_app_status TO authenticated;
GRANT ALL ON public.worker_app_status TO service_role;

ALTER TABLE public.worker_app_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all worker status"
  ON public.worker_app_status FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers view own status"
  ON public.worker_app_status FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Workers insert own status"
  ON public.worker_app_status FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Workers update own status"
  ON public.worker_app_status FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage worker status"
  ON public.worker_app_status FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER worker_app_status_updated_at
  BEFORE UPDATE ON public.worker_app_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
