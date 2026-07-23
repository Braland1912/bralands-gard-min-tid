import type { EveningRoundGuest } from "@/hooks/useEveningRoundGuests";

/**
 * Normaliserar ett registreringsnummer så att t.ex. "ABC 123", "abc-123"
 * och "ABC123" räknas som samma. Returnerar null om det inte finns något
 * meningsfullt värde att jämföra.
 */
export const normalizeReg = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-_.]/g, "").toUpperCase();
  if (cleaned.length < 3) return null;
  return cleaned;
};

export interface DuplicateGroup {
  reg: string;
  arrivalDate: string;
  guests: EveningRoundGuest[];
  prepaid: EveningRoundGuest[];
  manual: EveningRoundGuest[];
}

/**
 * Hittar par/grupper av gäster med samma normaliserade regnummer OCH samma
 * ankomstdatum, där minst en är förbetald och minst en är manuellt inlagd.
 * Det är dessa som är troliga dubbletter (förbetald + manuell) — och där
 * den förbetalda ska raderas.
 */
export const findDuplicateGuests = (
  guests: EveningRoundGuest[],
): DuplicateGroup[] => {
  const byKey = new Map<string, EveningRoundGuest[]>();

  for (const g of guests) {
    const reg = normalizeReg(g.registration_number);
    if (!reg) continue;
    const key = `${g.arrival_date}::${reg}`;
    const arr = byKey.get(key) ?? [];
    arr.push(g);
    byKey.set(key, arr);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, arr] of byKey.entries()) {
    if (arr.length < 2) continue;
    const prepaid = arr.filter((g) => g.is_prepaid);
    const manual = arr.filter((g) => !g.is_prepaid);
    // Bara varning när det verkligen är blandat (annars två manuella som
    // legitimt kan vara samma bil på olika platser — det får admin syna själv).
    if (prepaid.length === 0 || manual.length === 0) continue;
    const [arrivalDate, reg] = key.split("::");
    groups.push({ reg, arrivalDate, guests: arr, prepaid, manual });
  }

  // Sortera på ankomstdatum stigande, sedan regnummer.
  groups.sort((a, b) => {
    if (a.arrivalDate !== b.arrivalDate) return a.arrivalDate.localeCompare(b.arrivalDate);
    return a.reg.localeCompare(b.reg);
  });

  return groups;
};
