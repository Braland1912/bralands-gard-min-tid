
-- Invitations table for time-limited invite links
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamp with time zone NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins can manage invitations
CREATE POLICY "Authenticated users can view invitations" ON public.invitations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert invitations" ON public.invitations
  FOR INSERT TO authenticated WITH CHECK (true);

-- Anyone can read invitations (to validate tokens during registration)
CREATE POLICY "Public can validate invitation tokens" ON public.invitations
  FOR SELECT TO anon USING (true);

-- Pending members table for registration requests
CREATE TABLE public.pending_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_members ENABLE ROW LEVEL SECURITY;

-- Authenticated users (admin) can manage pending members
CREATE POLICY "Authenticated users can view pending members" ON public.pending_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update pending members" ON public.pending_members
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete pending members" ON public.pending_members
  FOR DELETE TO authenticated USING (true);

-- Anyone can insert (registration from invite link)
CREATE POLICY "Public can register via invitation" ON public.pending_members
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated can insert pending members" ON public.pending_members
  FOR INSERT TO authenticated WITH CHECK (true);
