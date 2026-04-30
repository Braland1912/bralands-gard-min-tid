ALTER TABLE public.evening_round_guests
  ADD COLUMN IF NOT EXISTS payment_currency text;