ALTER TABLE public.shift_checklists
  ADD COLUMN IF NOT EXISTS lodge_unit text;

ALTER TABLE public.shift_checklists
  DROP CONSTRAINT IF EXISTS shift_checklists_lodge_unit_check;

ALTER TABLE public.shift_checklists
  ADD CONSTRAINT shift_checklists_lodge_unit_check
  CHECK (lodge_unit IS NULL OR lodge_unit IN ('Öringen','Laxen','Kungsfiskaren','Strömstaren','Husvagnen'));

CREATE INDEX IF NOT EXISTS shift_checklists_lodge_unit_idx
  ON public.shift_checklists (shift_id, lodge_unit)
  WHERE lodge_unit IS NOT NULL;