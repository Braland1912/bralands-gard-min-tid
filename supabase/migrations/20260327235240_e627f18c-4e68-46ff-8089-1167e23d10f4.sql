-- Allow admins to insert time entries for any worker
CREATE POLICY "Admins can insert time entries"
ON public.time_entries
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));