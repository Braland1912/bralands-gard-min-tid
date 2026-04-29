-- Tables
CREATE TABLE public.evening_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  round_date date NOT NULL,
  round_time time NOT NULL DEFAULT '18:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_date, assigned_worker_id)
);

CREATE TABLE public.evening_round_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evening_round_id uuid NOT NULL REFERENCES public.evening_rounds(id) ON DELETE CASCADE,
  place_number int NOT NULL CHECK (place_number BETWEEN 1 AND 45),
  guest_name text NOT NULL,
  registration_number text,
  arrival_date date NOT NULL,
  departure_date date NOT NULL,
  payment_method text CHECK (payment_method IN ('S','P','Cp','Cc','R','B','K','Z')),
  payment_amount numeric(10,2),
  status text NOT NULL DEFAULT 'here' CHECK (status IN ('here','checked_out','not_here')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evening_round_id, place_number)
);

-- Indexes
CREATE INDEX idx_evening_rounds_date ON public.evening_rounds(round_date);
CREATE INDEX idx_evening_rounds_worker ON public.evening_rounds(assigned_worker_id);
CREATE INDEX idx_evening_round_guests_round_id ON public.evening_round_guests(evening_round_id);
CREATE INDEX idx_evening_round_guests_place ON public.evening_round_guests(place_number);

-- updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evening_rounds_updated
BEFORE UPDATE ON public.evening_rounds
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_evening_round_guests_updated
BEFORE UPDATE ON public.evening_round_guests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.evening_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evening_round_guests ENABLE ROW LEVEL SECURITY;

-- Helper: check if a worker_id belongs to current auth user
CREATE OR REPLACE FUNCTION public.is_my_worker(_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = _worker_id AND w.user_id = auth.uid()
  )
$$;

-- evening_rounds policies
CREATE POLICY "Admins manage rounds"
  ON public.evening_rounds FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers can view own rounds"
  ON public.evening_rounds FOR SELECT
  TO authenticated
  USING (public.is_my_worker(assigned_worker_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers can insert own rounds"
  ON public.evening_rounds FOR INSERT
  TO authenticated
  WITH CHECK (public.is_my_worker(assigned_worker_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers can update own rounds"
  ON public.evening_rounds FOR UPDATE
  TO authenticated
  USING (public.is_my_worker(assigned_worker_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_my_worker(assigned_worker_id) OR public.has_role(auth.uid(), 'admin'));

-- evening_round_guests policies
CREATE POLICY "Admins manage guests"
  ON public.evening_round_guests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers view guests in own rounds"
  ON public.evening_round_guests FOR SELECT
  TO authenticated
  USING (
    evening_round_id IN (
      SELECT er.id FROM public.evening_rounds er
      WHERE public.is_my_worker(er.assigned_worker_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Workers insert guests in own rounds"
  ON public.evening_round_guests FOR INSERT
  TO authenticated
  WITH CHECK (
    evening_round_id IN (
      SELECT er.id FROM public.evening_rounds er
      WHERE public.is_my_worker(er.assigned_worker_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Workers update guests in own rounds"
  ON public.evening_round_guests FOR UPDATE
  TO authenticated
  USING (
    evening_round_id IN (
      SELECT er.id FROM public.evening_rounds er
      WHERE public.is_my_worker(er.assigned_worker_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    evening_round_id IN (
      SELECT er.id FROM public.evening_rounds er
      WHERE public.is_my_worker(er.assigned_worker_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Workers delete guests in own rounds"
  ON public.evening_round_guests FOR DELETE
  TO authenticated
  USING (
    evening_round_id IN (
      SELECT er.id FROM public.evening_rounds er
      WHERE public.is_my_worker(er.assigned_worker_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.evening_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.evening_round_guests;