
-- 1) Utöka tillåtna passtyper i schedules
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_shift_type_check;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_shift_type_check
  CHECK (shift_type IN ('morning','day','evening','evening_a','evening_b','busy','off','fishing','clearing'));

-- 2) Skriv om alla framtida pass till nya standardtider (från och med idag)
UPDATE public.schedules
   SET start_time = '07:00:00'
 WHERE shift_type = 'morning'
   AND date >= CURRENT_DATE;

UPDATE public.schedules
   SET start_time = '09:00:00'
 WHERE shift_type = 'day'
   AND date >= CURRENT_DATE;

UPDATE public.schedules
   SET start_time = '18:00:00'
 WHERE shift_type = 'evening'
   AND date >= CURRENT_DATE;
