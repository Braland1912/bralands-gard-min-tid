-- Invitations: drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "Authenticated users can insert invitations" ON public.invitations;
DROP POLICY IF EXISTS "Authenticated users can view invitations" ON public.invitations;
DROP POLICY IF EXISTS "Authenticated users can update invitations" ON public.invitations;

-- Invitations: new admin-only policies (keep public SELECT for token validation)
CREATE POLICY "Admins can view invitations" ON public.invitations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert invitations" ON public.invitations FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invitations" ON public.invitations FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invitations" ON public.invitations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));