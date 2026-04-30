
-- Tillåt alla inloggade att läsa rundor (read-only utöver egen-redigering som finns)
DROP POLICY IF EXISTS "Workers can view own rounds" ON public.evening_rounds;
CREATE POLICY "Authenticated can view rounds"
  ON public.evening_rounds FOR SELECT
  TO authenticated
  USING (true);

-- Tillåt alla inloggade att läsa alla gäster
DROP POLICY IF EXISTS "Workers view guests in own rounds" ON public.evening_round_guests;
CREATE POLICY "Authenticated can view guests"
  ON public.evening_round_guests FOR SELECT
  TO authenticated
  USING (true);

-- Tillåt alla inloggade att se alla sessioner (för "Gick: Eva S." badge)
DROP POLICY IF EXISTS "Workers view own sessions" ON public.evening_round_sessions;
CREATE POLICY "Authenticated can view sessions"
  ON public.evening_round_sessions FOR SELECT
  TO authenticated
  USING (true);
