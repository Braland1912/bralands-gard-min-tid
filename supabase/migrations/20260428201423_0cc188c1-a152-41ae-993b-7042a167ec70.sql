-- Remove overly permissive anon SELECT policy on invitations.
-- Token validation is performed server-side by the register-member edge function (uses service role).
DROP POLICY IF EXISTS "Public can validate invitation tokens" ON public.invitations;