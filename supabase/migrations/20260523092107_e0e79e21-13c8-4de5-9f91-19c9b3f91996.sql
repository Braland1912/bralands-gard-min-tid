ALTER TABLE public.evening_round_summaries
ADD COLUMN IF NOT EXISTS selected_currencies text[] NOT NULL DEFAULT ARRAY['SEK']::text[];