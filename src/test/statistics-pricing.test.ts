import { describe, expect, it } from "vitest";
import { websitePricing, getPricingContext } from "../../supabase/functions/stats-report/pricing-context";

describe("website pricing supplied to statistics questions", () => {
  it("keeps the published low season vehicle rates and months", () => {
    expect(websitePricing.vehiclePerNight.lowSeason).toEqual({ months: [4, 5, 9], withElectricity: 325, withoutElectricity: 275 });
  });
  it("keeps the published high season vehicle rates and months", () => {
    expect(websitePricing.vehiclePerNight.highSeason).toEqual({ months: [6, 7, 8], withElectricity: 395, withoutElectricity: 345 });
  });
  it("keeps the tent base rate and extra person supplement", () => {
    expect(websitePricing.tentPerNight).toEqual({ firstPerson: 250, eachAdditionalPerson: 50 });
  });
  it("preserves the contradictory advertised weekly rules without equating them", () => {
    expect(websitePricing.weeklyOffer.stayNights).toBe(7);
    expect(websitePricing.weeklyOffer.payNights).toBe(6);
    expect(websitePricing.weeklyOffer.advertisedDiscountPercent).toBe(15);
    expect(websitePricing.weeklyOffer.effectiveDiscountPercent).toBeCloseTo(14.285714);
  });
  it("supplies the source, verification date and rates to the AI context", () => {
    const supplied = JSON.parse(getPricingContext().split("\n")[1]);
    expect(supplied.sourceUrl).toBe("https://www.bralandsgard.com/nature-camping/");
    expect(supplied.checkedOn).toBe("2026-11-17");
    expect(supplied.vehiclePerNight.highSeason.withElectricity).toBe(395);
  });
});