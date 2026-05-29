
-- Helper: is current user the assigned worker of a given evening round?
CREATE OR REPLACE FUNCTION public.is_round_owner(_round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.evening_rounds er
    JOIN public.workers w ON w.id = er.assigned_worker_id
    WHERE er.id = _round_id AND w.user_id = auth.uid()
  )
$$;

-- Helper: does the current user have team-visibility (can_see_team) or admin role?
CREATE OR REPLACE FUNCTION public.can_view_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.user_id = auth.uid() AND w.can_see_team = true
    )
$$;

-- ============================================================
-- evening_round_guests: tighten policies (currently all `true`)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view guests" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Authenticated can insert guests" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Authenticated can update guests" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Authenticated can delete guests" ON public.evening_round_guests;

-- Read: round owner, admin, or workers with can_see_team (matches existing team-visibility model)
CREATE POLICY "Round owner or team can view guests"
ON public.evening_round_guests
FOR SELECT TO authenticated
USING (
  public.is_round_owner(evening_round_id)
  OR public.can_view_team()
);

CREATE POLICY "Round owner can insert guests"
ON public.evening_round_guests
FOR INSERT TO authenticated
WITH CHECK (
  public.is_round_owner(evening_round_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Round owner can update guests"
ON public.evening_round_guests
FOR UPDATE TO authenticated
USING (
  public.is_round_owner(evening_round_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.is_round_owner(evening_round_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Round owner can delete guests"
ON public.evening_round_guests
FOR DELETE TO authenticated
USING (
  public.is_round_owner(evening_round_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ============================================================
-- evening_round_extra_places: tighten insert/delete (and view)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view extra places" ON public.evening_round_extra_places;
DROP POLICY IF EXISTS "Authenticated can insert extra places" ON public.evening_round_extra_places;
DROP POLICY IF EXISTS "Authenticated can delete extra places" ON public.evening_round_extra_places;

CREATE POLICY "Round owner or team can view extra places"
ON public.evening_round_extra_places
FOR SELECT TO authenticated
USING (
  public.is_round_owner(evening_round_id)
  OR public.can_view_team()
);

CREATE POLICY "Round owner can insert extra places"
ON public.evening_round_extra_places
FOR INSERT TO authenticated
WITH CHECK (
  public.is_round_owner(evening_round_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Round owner can delete extra places"
ON public.evening_round_extra_places
FOR DELETE TO authenticated
USING (
  public.is_round_owner(evening_round_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ============================================================
-- schedules: restrict broad SELECT (currently `true`)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read schedules" ON public.schedules;

CREATE POLICY "Workers read own or team schedules"
ON public.schedules
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.can_view_team()
);

-- ============================================================
-- realtime.messages: add baseline auth requirement.
-- Postgres-changes subscriptions still enforce table RLS,
-- so the table fixes above also protect realtime payloads.
-- ============================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can use realtime"
ON realtime.messages
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
