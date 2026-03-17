import { describe, it, expect } from "vitest"

import { calculateDuebendorfTariff } from "../duebendorf-tariff"

describe("calculateDuebendorfTariff", () => {
  // ===========================================================================
  // Gemeinde Duebendorf
  // ===========================================================================

  describe("Gemeinde tariffs", () => {
    it("single outbound trip = CHF 8", () => {
      const result = calculateDuebendorfTariff({
        zone: "gemeinde",
        direction: "outbound",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(8.0)
      expect(result.zone).toBe("gemeinde")
    })

    it("single return trip = CHF 8", () => {
      const result = calculateDuebendorfTariff({
        zone: "gemeinde",
        direction: "return",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(8.0)
    })

    it("round trip under 2h = CHF 12", () => {
      const result = calculateDuebendorfTariff({
        zone: "gemeinde",
        direction: "both",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(12.0)
    })

    it("round trip over 2h = CHF 16", () => {
      const result = calculateDuebendorfTariff({
        zone: "gemeinde",
        direction: "both",
        durationCategory: "over_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(16.0)
    })

    it("Tagesheim Imwil round trip = CHF 14", () => {
      const result = calculateDuebendorfTariff({
        zone: "gemeinde",
        direction: "both",
        durationCategory: "under_2h",
        isTagesheimImwil: true,
        hasEscort: false,
      })
      expect(result.price).toBe(14.0)
      expect(result.tariffType).toContain("Tagesheim Imwil")
    })

    it("Tagesheim Imwil single trip still = CHF 8 (not Imwil price)", () => {
      const result = calculateDuebendorfTariff({
        zone: "gemeinde",
        direction: "outbound",
        durationCategory: "under_2h",
        isTagesheimImwil: true,
        hasEscort: false,
      })
      // Tagesheim Imwil special price only applies to round trips
      expect(result.price).toBe(8.0)
    })
  })

  // ===========================================================================
  // Zone Tariffs
  // ===========================================================================

  describe("Zone tariffs", () => {
    it("Zone 1 under 2h = CHF 16", () => {
      const result = calculateDuebendorfTariff({
        zone: "zone_1",
        direction: "both",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(16.0)
    })

    it("Zone 1 over 2h = CHF 24", () => {
      const result = calculateDuebendorfTariff({
        zone: "zone_1",
        direction: "both",
        durationCategory: "over_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(24.0)
    })

    it("Zone 2 under 2h = CHF 25", () => {
      const result = calculateDuebendorfTariff({
        zone: "zone_2",
        direction: "both",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(25.0)
    })

    it("Zone 2 over 2h = CHF 45", () => {
      const result = calculateDuebendorfTariff({
        zone: "zone_2",
        direction: "both",
        durationCategory: "over_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(45.0)
    })

    it("Zone 3 under 2h = CHF 35", () => {
      const result = calculateDuebendorfTariff({
        zone: "zone_3",
        direction: "both",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(35.0)
    })

    it("Zone 3 over 2h = CHF 55", () => {
      const result = calculateDuebendorfTariff({
        zone: "zone_3",
        direction: "both",
        durationCategory: "over_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.price).toBe(55.0)
    })

    it("escort surcharge does NOT apply to zone tariffs", () => {
      const result = calculateDuebendorfTariff({
        zone: "zone_2",
        direction: "both",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: true, // should be ignored for zones
      })
      expect(result.price).toBe(25.0)
    })
  })

  // ===========================================================================
  // Ausserkantonal
  // ===========================================================================

  describe("Ausserkantonal tariffs", () => {
    it("outbound 10km = CHF 10.00", () => {
      const result = calculateDuebendorfTariff({
        zone: "ausserkantonal",
        direction: "outbound",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: false,
        distanceKm: 10,
      })
      expect(result.price).toBe(10.0)
    })

    it("round trip 10km = CHF 20.00 (10km * 2)", () => {
      const result = calculateDuebendorfTariff({
        zone: "ausserkantonal",
        direction: "both",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: false,
        distanceKm: 10,
      })
      expect(result.price).toBe(20.0)
    })

    it("with escort adds CHF 20 surcharge", () => {
      const result = calculateDuebendorfTariff({
        zone: "ausserkantonal",
        direction: "outbound",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: true,
        distanceKm: 10,
      })
      // 10km * CHF 1.00 + CHF 20 escort = CHF 30
      expect(result.price).toBe(30.0)
      expect(result.breakdown).toHaveLength(2)
      expect(result.breakdown[1]!.label).toContain("Begleitung")
      expect(result.breakdown[1]!.amount).toBe(20.0)
    })

    it("zero distance = CHF 0 (plus escort if applicable)", () => {
      const result = calculateDuebendorfTariff({
        zone: "ausserkantonal",
        direction: "outbound",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: false,
        distanceKm: 0,
      })
      expect(result.price).toBe(0.0)
    })
  })

  // ===========================================================================
  // Breakdown structure
  // ===========================================================================

  describe("breakdown", () => {
    it("returns correct breakdown items for zone tariff", () => {
      const result = calculateDuebendorfTariff({
        zone: "zone_2",
        direction: "both",
        durationCategory: "over_2h",
        isTagesheimImwil: false,
        hasEscort: false,
      })
      expect(result.breakdown).toHaveLength(1)
      expect(result.breakdown[0]!.amount).toBe(45.0)
    })

    it("returns breakdown with escort surcharge for ausserkantonal", () => {
      const result = calculateDuebendorfTariff({
        zone: "ausserkantonal",
        direction: "outbound",
        durationCategory: "under_2h",
        isTagesheimImwil: false,
        hasEscort: true,
        distanceKm: 15,
      })
      expect(result.breakdown).toHaveLength(2)
      const total = result.breakdown.reduce((s, b) => s + b.amount, 0)
      expect(total).toBe(result.price)
    })
  })
})
