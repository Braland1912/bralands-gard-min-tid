CREATE TABLE public.schedule_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read schedule days"
  ON public.schedule_days FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage schedule days"
  ON public.schedule_days FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));