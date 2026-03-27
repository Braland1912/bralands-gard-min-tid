-- Workers: drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can view workers" ON public.workers;
DROP POLICY IF EXISTS "Authenticated users can delete workers" ON public.workers;
DROP POLICY IF EXISTS "Authenticated users can insert workers" ON public.workers;
DROP POLICY IF EXISTS "Authenticated users can update workers" ON public.workers;

-- Workers: new scoped policies
CREATE POLICY "Workers can view own record" ON public.workers FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert workers" ON public.workers FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update workers" ON public.workers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete workers" ON public.workers FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- pending_members: drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated can insert pending members" ON public.pending_members;
DROP POLICY IF EXISTS "Authenticated users can delete pending members" ON public.pending_members;
DROP POLICY IF EXISTS "Authenticated users can update pending members" ON public.pending_members;
DROP POLICY IF EXISTS "Authenticated users can view pending members" ON public.pending_members;

-- pending_members: new scoped policies (keep anon insert for registration)
CREATE POLICY "Admins can view pending members" ON public.pending_members FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pending members" ON public.pending_members FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pending members" ON public.pending_members FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert pending members" ON public.pending_members FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));