ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS lodge_unit text;

ALTER TABLE public.checklist_templates
  DROP CONSTRAINT IF EXISTS checklist_templates_lodge_unit_check;

ALTER TABLE public.checklist_templates
  ADD CONSTRAINT checklist_templates_lodge_unit_check
  CHECK (lodge_unit IS NULL OR lodge_unit IN ('Öringen','Laxen','Kungsfiskaren','Strömstaren','Husvagnen'));