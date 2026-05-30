
-- Tillåt alla registrerade medarbetare att se och hantera kvällsrundans gäster,
-- inte bara den som är ansvarig för rundan eller har "kan se team".
-- Förbetalda gäster behöver kunna registreras av vem som helst i personalen.

DROP POLICY IF EXISTS "Round owner or team can view guests" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Team can insert guests" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Team can update guests" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Team can delete guests" ON public.evening_round_guests;

CREATE POLICY "Workers can view guests"
  ON public.evening_round_guests FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid())
  );

CREATE POLICY "Workers can insert guests"
  ON public.evening_round_guests FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid())
  );

CREATE POLICY "Workers can update guests"
  ON public.evening_round_guests FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid())
  );

CREATE POLICY "Workers can delete guests"
  ON public.evening_round_guests FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid())
  );
