
DROP POLICY IF EXISTS "Round owner can insert guests" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Round owner can update guests" ON public.evening_round_guests;
DROP POLICY IF EXISTS "Round owner can delete guests" ON public.evening_round_guests;

CREATE POLICY "Team can insert guests"
ON public.evening_round_guests
FOR INSERT
TO authenticated
WITH CHECK (can_view_team() OR is_round_owner(evening_round_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can update guests"
ON public.evening_round_guests
FOR UPDATE
TO authenticated
USING (can_view_team() OR is_round_owner(evening_round_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (can_view_team() OR is_round_owner(evening_round_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can delete guests"
ON public.evening_round_guests
FOR DELETE
TO authenticated
USING (can_view_team() OR is_round_owner(evening_round_id) OR has_role(auth.uid(), 'admin'::app_role));
