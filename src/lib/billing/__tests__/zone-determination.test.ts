import { describe, it, expect } from "vitest"

import { determineTariffZone, isTagesheimImwil } from "../zone-determination"

describe("determineTariffZone", () => {
  it("returns gemeinde for PLZ 8600", () => {
    expect(determineTariffZone("8600", null)).toBe("gemeinde")
  })

  it("returns zone_1 for Zurich rechts (e.g. 8050 Oerlikon)", () => {
    expect(determineTariffZone("8050", null)).toBe("zone_1")
  })

  it("returns zone_1 for Zurich rechts (e.g. 8001 Altstadt)", () => {
    expect(determineTariffZone("8001", null)).toBe("zone_1")
  })

  it("returns zone_3 for Zurich links (e.g. 8047 Wiedikon)", () => {
    expect(determineTariffZone("8047", null)).toBe("zone_3")
  })

  it("returns zone_3 for Zurich links (e.g. 8048 Altstetten)", () => {
    expect(determineTariffZone("8048", null)).toBe("zone_3")
  })

  it("respects DB zone name for Zurich rechts if mapped", () => {
    expect(determineTariffZone("8050", "Zone 2")).toBe("zone_2")
  })

  it("returns DB zone for non-Zurich postal codes", () => {
    expect(determineTariffZone("8304", "Zone 1")).toBe("zone_1")
    expect(determineTariffZone("8305", "Zone 2")).toBe("zone_2")
    expect(determineTariffZone("8400", "Zone 3")).toBe("zone_3")
  })

  it("returns ausserkantonal when no DB zone and not Zurich/Duebendorf", () => {
    expect(determineTariffZone("5000", null)).toBe("ausserkantonal")
    expect(determineTariffZone("3000", null)).toBe("ausserkantonal")
    expect(determineTariffZone("6000", null)).toBe("ausserkantonal")
  })

  it("returns ausserkantonal for unknown DB zone name", () => {
    expect(determineTariffZone("5000", "Unknown Zone")).toBe("ausserkantonal")
  })

  it("handles Nachbargemeinden zone name", () => {
    expect(determineTariffZone("8304", "Nachbargemeinden")).toBe("zone_1")
  })

  it("handles Mittlerer Ring zone name", () => {
    expect(determineTariffZone("8400", "Mittlerer Ring")).toBe("zone_2")
  })

  it("handles Bis Kantonsgrenze zone name", () => {
    expect(determineTariffZone("8500", "Bis Kantonsgrenze")).toBe("zone_3")
  })
})

describe("isTagesheimImwil", () => {
  it("detects Tagesheim Imwil (exact match)", () => {
    expect(isTagesheimImwil("Tagesheim Imwil")).toBe(true)
  })

  it("detects partial match (case-insensitive)", () => {
    expect(isTagesheimImwil("tagesheim imwil")).toBe(true)
    expect(isTagesheimImwil("Imwil Tagesheim")).toBe(true)
  })

  it("returns false for unrelated names", () => {
    expect(isTagesheimImwil("Arztpraxis Duebendorf")).toBe(false)
    expect(isTagesheimImwil("Spital Zurich")).toBe(false)
  })
})
