
-- Allow authenticated users to insert workers (for admin approval flow)
CREATE POLICY "Authenticated users can insert workers" ON public.workers
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update invitations
CREATE POLICY "Authenticated users can update invitations" ON public.invitations
  FOR UPDATE TO authenticated USING (true);
