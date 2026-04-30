/**
 * Validering av platsnamn för Kvällsrundan.
 * Tillåtna tecken: bokstäver (a-z, å, ä, ö), siffror, mellanslag, bindestreck och snedstreck.
 */
export const PLACE_LABEL_MAX = 60;

// Notera: vi tillåter både gemener och versaler – jämförelse sker case-insensitivt.
const ALLOWED_REGEX = /^[A-Za-zÅÄÖåäö0-9 \-/]+$/;

export type PlaceLabelValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Validerar och normaliserar (trimmar + kollapsar mellanslag).
 * Returnerar fel om tomt, för långt eller har ogiltiga tecken.
 */
export const validatePlaceLabel = (
  raw: string,
  existingLabels: string[] = [],
): PlaceLabelValidation => {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Ange ett namn på platsen" };
  if (trimmed.length > PLACE_LABEL_MAX) {
    return { ok: false, error: `Max ${PLACE_LABEL_MAX} tecken` };
  }
  if (!ALLOWED_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: "Endast bokstäver, siffror, mellanslag, - och / är tillåtna",
    };
  }
  const lower = trimmed.toLowerCase();
  const dup = existingLabels.some((l) => l.trim().toLowerCase() === lower);
  if (dup) return { ok: false, error: `Platsen "${trimmed}" finns redan` };
  return { ok: true, value: trimmed };
};
