-- Säkerställ att extra-platsnamn är unika per runda (case-insensitivt) och att namnet bara innehåller tillåtna tecken.
CREATE UNIQUE INDEX IF NOT EXISTS evening_round_extra_places_unique_label_per_round
  ON public.evening_round_extra_places (evening_round_id, lower(label));

ALTER TABLE public.evening_round_extra_places
  ADD CONSTRAINT evening_round_extra_places_label_format_chk
  CHECK (
    length(btrim(label)) BETWEEN 1 AND 60
    AND label ~ '^[A-Za-zÅÄÖåäö0-9 \-/]+$'
  );
