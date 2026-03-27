-- 1. Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. RLS policies for user_roles table
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Insert admin role for info@bralandsgard.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'info@bralandsgard.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Secure time_entries - drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Anyone can update time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Anyone can view time entries" ON public.time_entries;

-- 6. New scoped policies for time_entries
CREATE POLICY "Workers can view own time entries"
ON public.time_entries FOR SELECT TO authenticated
USING (
  worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Workers can insert own time entries"
ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (
  worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
);

CREATE POLICY "Workers can update own time entries"
ON public.time_entries FOR UPDATE TO authenticated
USING (
  worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete time entries"
ON public.time_entries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));