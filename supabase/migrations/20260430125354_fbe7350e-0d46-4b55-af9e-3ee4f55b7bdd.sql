
-- 1. Add new text column for guest place
ALTER TABLE public.evening_round_guests ADD COLUMN place_label text;
UPDATE public.evening_round_guests SET place_label = place_number::text;
ALTER TABLE public.evening_round_guests ALTER COLUMN place_label SET NOT NULL;
ALTER TABLE public.evening_round_guests DROP COLUMN place_number;

-- 2. Extra places table
CREATE TABLE public.evening_round_extra_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evening_round_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (evening_round_id, label)
);

ALTER TABLE public.evening_round_extra_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view extra places"
  ON public.evening_round_extra_places FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage extra places"
  ON public.evening_round_extra_places FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers insert extra places in own rounds"
  ON public.evening_round_extra_places FOR INSERT
  TO authenticated
  WITH CHECK (
    evening_round_id IN (
      SELECT er.id FROM public.evening_rounds er
      WHERE is_my_worker(er.assigned_worker_id)
    ) OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Workers delete extra places in own rounds"
  ON public.evening_round_extra_places FOR DELETE
  TO authenticated
  USING (
    evening_round_id IN (
      SELECT er.id FROM public.evening_rounds er
      WHERE is_my_worker(er.assigned_worker_id)
    ) OR has_role(auth.uid(), 'admin'::app_role)
  );
