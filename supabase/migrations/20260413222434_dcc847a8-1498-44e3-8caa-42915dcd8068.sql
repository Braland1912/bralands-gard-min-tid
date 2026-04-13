
-- Add can_see_team to workers table
ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS can_see_team boolean NOT NULL DEFAULT true;

-- Create schedules table
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('morning','day','evening','busy','off')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read schedules
CREATE POLICY "Authenticated users can read schedules"
ON public.schedules FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert/update/delete schedules
CREATE POLICY "Admins can write schedules"
ON public.schedules FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
