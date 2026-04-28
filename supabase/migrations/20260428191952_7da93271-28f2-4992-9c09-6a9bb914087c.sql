-- Add optional note column for busy markings
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS note TEXT;

-- Workers can insert their own busy entries (today or future), with non-empty note,
-- and only if no other shift exists for that date/user
CREATE POLICY "Workers can insert own busy"
ON public.schedules
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND shift_type = 'busy'
  AND date >= CURRENT_DATE
  AND note IS NOT NULL
  AND length(trim(note)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.schedules s2
    WHERE s2.user_id = schedules.user_id
      AND s2.date = schedules.date
      AND s2.shift_type <> 'busy'
  )
);

-- Workers can update their own busy entries (today or future), with non-empty note
CREATE POLICY "Workers can update own busy"
ON public.schedules
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND shift_type = 'busy'
  AND date >= CURRENT_DATE
)
WITH CHECK (
  auth.uid() = user_id
  AND shift_type = 'busy'
  AND date >= CURRENT_DATE
  AND note IS NOT NULL
  AND length(trim(note)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.schedules s2
    WHERE s2.user_id = schedules.user_id
      AND s2.date = schedules.date
      AND s2.shift_type <> 'busy'
      AND s2.id <> schedules.id
  )
);

-- Workers can delete their own busy entries (today or future)
CREATE POLICY "Workers can delete own busy"
ON public.schedules
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND shift_type = 'busy'
  AND date >= CURRENT_DATE
);