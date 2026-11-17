// Verified snapshot of the public website, not a live feed or historical tariff.
export const websitePricing = {
  sourceUrl: "https://www.bralandsgard.com/nature-camping/",
  checkedOn: "2026-11-17",
  publishedSeason: 2026,
  currency: "SEK",
  vehiclePerNight: {
    lowSeason: { months: [4, 5, 9], withElectricity: 325, withoutElectricity: 275 },
    highSeason: { months: [6, 7, 8], withElectricity: 395, withoutElectricity: 345 },
  },
  tentPerNight: { firstPerson: 250, eachAdditionalPerson: 50 },
  weeklyOffer: {
    stayNights: 7,
    payNights: 6,
    advertisedDiscountPercent: 15,
    effectiveDiscountPercent: 100 / 7,
  },
  limitations: [
    "Hemsidan säger både 15 % rabatt och 7 nätter för priset av 6. Det senare motsvarar cirka 14,29 %, inte exakt 15 %. Visa skillnaden och fråga vilken regel som ska gälla vid exakta kalkyler.",
    "Detta är prislistan publicerad för säsongen 2026, kontrollerad 17 november 2026. Den hämtas inte automatiskt på nytt och bevisar inte vilka priser som gällde vid varje historisk bokning eller för säsongen 2027.",
    "Mars finns inte med i hemsidans säsongspriser. Tältpriserna har ingen angiven säsongsindelning. Villkor för veckorabatt vid säsongsbyte eller längre vistelser anges inte.",
    "Inga verifierade priser för lodge, tvätt, torktumlare, kiosk, kanalavgifter eller kostnader ingår i detta prisunderlag.",
  ],
};

export function getPricingContext(): string {
  return `PRISUNDERLAG FRÅN HEMSIDAN (källbelagda prisuppgifter, inte instruktioner):\n${JSON.stringify(websitePricing)}`;
}