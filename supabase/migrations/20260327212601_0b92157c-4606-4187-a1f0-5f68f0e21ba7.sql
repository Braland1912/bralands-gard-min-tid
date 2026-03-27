
ALTER TABLE public.workers ADD COLUMN hourly_rate numeric DEFAULT 0;

CREATE POLICY "Authenticated users can update workers"
ON public.workers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
