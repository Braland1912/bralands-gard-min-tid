DROP POLICY IF EXISTS "Round owner can insert extra places" ON public.evening_round_extra_places;
DROP POLICY IF EXISTS "Round owner can delete extra places" ON public.evening_round_extra_places;

CREATE POLICY "Team can insert extra places"
ON public.evening_round_extra_places
FOR INSERT TO authenticated
WITH CHECK (can_view_team() OR is_round_owner(evening_round_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can delete extra places"
ON public.evening_round_extra_places
FOR DELETE TO authenticated
USING (can_view_team() OR is_round_owner(evening_round_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can update extra places"
ON public.evening_round_extra_places
FOR UPDATE TO authenticated
USING (can_view_team() OR is_round_owner(evening_round_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (can_view_team() OR is_round_owner(evening_round_id) OR has_role(auth.uid(), 'admin'::app_role));