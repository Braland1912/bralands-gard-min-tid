CREATE POLICY "Admins can delete correction requests"
ON public.time_correction_requests
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));