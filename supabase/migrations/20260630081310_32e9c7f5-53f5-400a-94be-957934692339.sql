
ALTER TABLE public.checklist_template_groups
  ADD COLUMN IF NOT EXISTS is_evening_round boolean NOT NULL DEFAULT false;

-- Bara en grupp åt gången får vara markerad som kvällsrundans grupp
CREATE UNIQUE INDEX IF NOT EXISTS checklist_template_groups_only_one_evening_round
  ON public.checklist_template_groups ((is_evening_round)) WHERE is_evening_round = true;
