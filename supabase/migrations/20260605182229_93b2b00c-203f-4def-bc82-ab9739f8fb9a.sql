
ALTER TABLE public.calendar_feed_tokens ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "Users can view their own calendar feed tokens"
ON public.calendar_feed_tokens FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own calendar feed tokens"
ON public.calendar_feed_tokens FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND created_by = auth.uid());
