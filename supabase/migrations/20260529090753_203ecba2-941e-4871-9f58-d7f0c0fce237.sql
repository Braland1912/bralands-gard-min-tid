-- Add support for prepaid (no-place-yet) guests and temporary (off-grid) places.

-- Allow new accommodation type and add columns for prepaid flag and free-text description.
ALTER TABLE public.evening_round_guests
  ADD COLUMN IF NOT EXISTS is_prepaid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temp_description text NULL;

-- Helpful index for the "Incoming" list lookup
CREATE INDEX IF NOT EXISTS idx_evening_round_guests_prepaid_no_place
  ON public.evening_round_guests (evening_round_id)
  WHERE place_label IS NULL AND is_prepaid = true;