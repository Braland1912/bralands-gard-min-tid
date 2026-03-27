CREATE POLICY "Authenticated users can delete workers"
ON public.workers
FOR DELETE
TO authenticated
USING (true);