
CREATE TABLE public.time_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  worker_name text NOT NULL,
  date date NOT NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_correction_requests ENABLE ROW LEVEL SECURITY;

-- Workers can insert their own requests (match auth user to worker)
CREATE POLICY "Workers can insert own correction requests"
ON public.time_correction_requests
FOR INSERT
TO authenticated
WITH CHECK (
  worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
);

-- Workers can view their own requests
CREATE POLICY "Workers can view own correction requests"
ON public.time_correction_requests
FOR SELECT
TO authenticated
USING (
  worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
  OR
  auth.uid() IN (SELECT created_by FROM public.invitations)
);

-- Admins can update all requests (admins are users who created invitations)
CREATE POLICY "Admins can update correction requests"
ON public.time_correction_requests
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT created_by FROM public.invitations)
);
