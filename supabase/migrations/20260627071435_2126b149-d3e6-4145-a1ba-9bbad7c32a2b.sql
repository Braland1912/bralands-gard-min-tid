
DROP POLICY IF EXISTS "Team can insert extra places" ON public.evening_round_extra_places;
DROP POLICY IF EXISTS "Team can update extra places" ON public.evening_round_extra_places;
DROP POLICY IF EXISTS "Team can delete extra places" ON public.evening_round_extra_places;
DROP POLICY IF EXISTS "Round owner or team can view extra places" ON public.evening_round_extra_places;

CREATE POLICY "Workers can view extra places"
  ON public.evening_round_extra_places FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers can insert extra places"
  ON public.evening_round_extra_places FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers can update extra places"
  ON public.evening_round_extra_places FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers can delete extra places"
  ON public.evening_round_extra_places FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
