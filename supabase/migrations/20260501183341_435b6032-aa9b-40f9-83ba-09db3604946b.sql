-- Allow all authenticated users to manage guests and extra places in any evening round
DROP POLICY IF EXISTS "Workers insert guests in own rounds" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Workers update guests in own rounds" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Workers delete guests in own rounds" ON public.evening_round_guests;

CREATE POLICY "Authenticated can insert guests"
ON public.evening_round_guests FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update guests"
ON public.evening_round_guests FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete guests"
ON public.evening_round_guests FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Workers insert extra places in own rounds" ON public.evening_round_extra_places;
DROP POLICY IF EXISTS "Workers delete extra places in own rounds" ON public.evening_round_extra_places;

CREATE POLICY "Authenticated can insert extra places"
ON public.evening_round_extra_places FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can delete extra places"
ON public.evening_round_extra_places FOR DELETE
TO authenticated
USING (true);