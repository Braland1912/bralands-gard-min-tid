ALTER TABLE public.evening_round_guests
ADD COLUMN IF NOT EXISTS accommodation_type text NOT NULL DEFAULT 'vehicle'
CHECK (accommodation_type IN ('vehicle', 'tent'));