
CREATE TABLE public.task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  requires_note boolean NOT NULL DEFAULT false,
  checklist_items text[] NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.task_categories TO authenticated;
GRANT ALL ON public.task_categories TO service_role;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan se kategorier"
  ON public.task_categories FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Admins kan lägga till kategorier"
  ON public.task_categories FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins kan uppdatera kategorier"
  ON public.task_categories FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins kan ta bort kategorier"
  ON public.task_categories FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  category_id uuid NULL REFERENCES public.task_categories(id) ON DELETE SET NULL,
  category_label text NOT NULL,
  note text NULL,
  checklist_state jsonb NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medarbetare kan se egna loggar"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (
    public.is_my_worker(worker_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
CREATE POLICY "Medarbetare kan skapa egna loggar"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_my_worker(worker_id));
CREATE POLICY "Medarbetare kan uppdatera egna loggar"
  ON public.activity_logs FOR UPDATE
  TO authenticated
  USING (
    public.is_my_worker(worker_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
CREATE POLICY "Admins kan ta bort loggar"
  ON public.activity_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_activity_logs_time_entry ON public.activity_logs(time_entry_id);
CREATE INDEX idx_activity_logs_worker ON public.activity_logs(worker_id);
CREATE INDEX idx_activity_logs_open ON public.activity_logs(worker_id) WHERE ended_at IS NULL;

INSERT INTO public.task_categories (label, requires_note, checklist_items, sort_order) VALUES
  ('Förberedelser av guidning', false, NULL, 1),
  ('Guidning', false, NULL, 2),
  ('Återställande av guidning', false, NULL, 3),
  ('Vedhantering', false, NULL, 4),
  ('Gräsklippning', false, NULL, 5),
  ('Röjsåg', false, NULL, 6),
  ('Städ av camping', false, ARRAY['Servicehus','Sopor','Kiosk','Utedass','Grillstugor'], 7),
  ('Gästservice', true, NULL, 8);
