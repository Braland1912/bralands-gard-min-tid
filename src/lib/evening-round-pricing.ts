/**
 * Prismatris för Bråland Gård 2026
 * Säsong: 31 mars – 30 september 2026
 * Rabatt: boka 7 nätter, betala 6 (varje 7:e natt är gratis)
 */

export type PricingAccommodation = "vehicle" | "tent";

const HIGH_SEASON_MONTHS = new Set([6, 7, 8]); // juni, juli, augusti
const LOW_SEASON_MONTHS = new Set([4, 5, 9]); // april, maj, september

/** Antal nätter mellan ankomst och avresa (lokal tid). */
export const computeNights = (arrivalIso: string, departureIso: string): number => {
  if (!arrivalIso || !departureIso) return 0;
  const [ay, am, ad] = arrivalIso.split("-").map(Number);
  const [dy, dm, dd] = departureIso.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const d = new Date(dy, dm - 1, dd).getTime();
  const diff = Math.round((d - a) / 86_400_000);
  return diff > 0 ? diff : 0;
};

/** Returnerar pris per natt för ett givet datum (ISO yyyy-mm-dd). */
const nightlyRate = (
  iso: string,
  accommodation: PricingAccommodation,
  opts: { hasElectricity?: boolean; tentPersons?: number },
): number => {
  const month = Number(iso.split("-")[1]);
  if (accommodation === "vehicle") {
    const high = HIGH_SEASON_MONTHS.has(month);
    const low = LOW_SEASON_MONTHS.has(month);
    if (!high && !low) return 0; // utanför säsong
    if (opts.hasElectricity) return high ? 395 : 325;
    return high ? 345 : 275;
  }
  // Tält: pris per natt baserat på antal personer
  const persons = Math.max(1, Math.min(opts.tentPersons ?? 1, 20));
  return 200 + persons * 50; // 1p=250, 2p=300, 3p=350, 4p=400 ...
};

/**
 * Räknar ut totalpris i SEK för vistelsen.
 * Returnerar `null` om för lite information för att räkna.
 */
export const computeStayPrice = (params: {
  arrival: string;
  departure: string;
  accommodation: PricingAccommodation;
  hasElectricity?: boolean;
  tentPersons?: number;
}): number | null => {
  const nights = computeNights(params.arrival, params.departure);
  if (nights <= 0) return null;

  // Räkna pris per natt över hela vistelsen (säsongen kan skifta inom vistelsen)
  const [ay, am, ad] = params.arrival.split("-").map(Number);
  const rates: number[] = [];
  for (let i = 0; i < nights; i++) {
    const d = new Date(ay, am - 1, ad + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    rates.push(
      nightlyRate(iso, params.accommodation, {
        hasElectricity: params.hasElectricity,
        tentPersons: params.tentPersons,
      }),
    );
  }
  // Rabatt: var 7:e natt gratis – gör den billigaste natten i varje 7-block gratis
  let total = 0;
  for (let block = 0; block < rates.length; block += 7) {
    const slice = rates.slice(block, block + 7);
    const sum = slice.reduce((a, b) => a + b, 0);
    if (slice.length === 7) {
      total += sum - Math.min(...slice);
    } else {
      total += sum;
    }
  }
  return total > 0 ? total : null;
}

