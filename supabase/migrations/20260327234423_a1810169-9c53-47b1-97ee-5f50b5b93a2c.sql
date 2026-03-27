-- Fix time_correction_requests SELECT policy to use has_role instead of invitations.created_by
DROP POLICY IF EXISTS "Workers can view own correction requests" ON public.time_correction_requests;
CREATE POLICY "Workers can view own correction requests"
ON public.time_correction_requests
FOR SELECT
TO authenticated
USING (
  (worker_id IN (SELECT workers.id FROM workers WHERE workers.user_id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix time_correction_requests UPDATE policy to use has_role
DROP POLICY IF EXISTS "Admins can update correction requests" ON public.time_correction_requests;
CREATE POLICY "Admins can update correction requests"
ON public.time_correction_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));