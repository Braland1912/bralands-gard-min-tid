CREATE POLICY "Authenticated users can delete invitations"
ON public.invitations
FOR DELETE
TO authenticated
USING (true);