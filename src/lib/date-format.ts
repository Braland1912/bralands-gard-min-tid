/**
 * Datumhantering som respekterar lokal tidszon.
 *
 * Problemet: `new Date("2026-05-01")` tolkas som UTC midnight, vilket i
 * Sverige (UTC+1/+2) blir 01:00/02:00 lokal tid – fortfarande rätt dag.
 * MEN i andra tidszoner (eller vid sommartids-edge cases) kan datumet
 * "hoppa" en dag bakåt när det formateras lokalt. Vi vill alltid att
 * en YYYY-MM-DD-sträng från databasen visas som EXAKT den dagen, lokalt.
 */

/** Parsa en ISO-datumsträng (YYYY-MM-DD) som ett lokalt datum vid 00:00. */
export const parseLocalDate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** YYYY-MM-DD för dagens datum i användarens lokala tidszon. */
export const todayLocalISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Skifta en YYYY-MM-DD-sträng N dagar (negativt eller positivt). */
export const shiftLocalDate = (iso: string, days: number): string => {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Konsekvent svenskt datumformat för UI-visning.
 * Variants:
 *  - "long":   "fredag 1 maj 2026"  (fullständig, för rubriker)
 *  - "medium": "1 maj 2026"          (för listor)
 *  - "short":  "2026-05-01"          (kompakt, sortbart)
 *  - "weekday-medium": "fre 1 maj"   (för kort/cards)
 */
export type DateVariant = "long" | "medium" | "short" | "weekday-medium";

const OPTS: Record<DateVariant, Intl.DateTimeFormatOptions> = {
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  medium: { day: "numeric", month: "long", year: "numeric" },
  short: { year: "numeric", month: "2-digit", day: "2-digit" },
  "weekday-medium": { weekday: "short", day: "numeric", month: "short" },
};

/**
 * Formatera en YYYY-MM-DD-sträng (eller Date) till svensk text utan att
 * råka skifta dag pga UTC-tolkning.
 */
export const formatLocalDate = (
  value: string | Date | null | undefined,
  variant: DateVariant = "medium",
): string => {
  if (!value) return "";
  const d = typeof value === "string" ? parseLocalDate(value) : value;
  return d.toLocaleDateString("sv-SE", OPTS[variant]);
};

/** Formatera en timestamp (med tidszon) till "HH:MM" lokalt. */
export const formatLocalTime = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
};

/** Formatera en timestamp till "1 maj 2026, 18:42" lokalt. */
export const formatLocalDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.toLocaleDateString("sv-SE", OPTS.medium)}, ${d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`;
};
