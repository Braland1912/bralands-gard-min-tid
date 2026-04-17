-- Add shift_index to schedules to allow two shifts per person per day
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS shift_index integer NOT NULL DEFAULT 0;

-- Drop old unique constraint on (user_id, date) if it exists
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.schedules'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.schedules DROP CONSTRAINT %I', c.conname);
  END LOOP;
END$$;

-- Drop any unique indexes on (user_id, date) only
DROP INDEX IF EXISTS schedules_user_id_date_key;
DROP INDEX IF EXISTS schedules_user_date_idx;

-- Add new unique constraint on (user_id, date, shift_index)
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_user_date_shiftindex_key UNIQUE (user_id, date, shift_index);