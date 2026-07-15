import { describe, it, expect } from "vitest"
import {
  buildRideDescription,
  formatAmount,
  formatChf,
  formatKm,
  formatDateShort,
  sumAmounts,
} from "@/lib/receipts/format"

describe("buildRideDescription", () => {
  it("formats '<Ort> → <Ziel> (<Richtung>)' for outbound", () => {
    expect(buildRideDescription("Dübendorf", "USZ Zürich", "outbound")).toBe(
      "Dübendorf → USZ Zürich (Hinfahrt)"
    )
  })

  it("uses the German return label", () => {
    expect(buildRideDescription("Zürich", "Praxis Meier", "return")).toBe(
      "Zürich → Praxis Meier (Rückfahrt)"
    )
  })

  it("uses the combined label for 'both'", () => {
    expect(buildRideDescription("Uster", "Spital", "both")).toBe(
      "Uster → Spital (Hin & Rück)"
    )
  })

  it("falls back to 'Start' when the origin city is empty or null", () => {
    expect(buildRideDescription(null, "USZ", "outbound")).toBe(
      "Start → USZ (Hinfahrt)"
    )
    expect(buildRideDescription("   ", "USZ", "outbound")).toBe(
      "Start → USZ (Hinfahrt)"
    )
  })
})

describe("formatAmount / formatChf", () => {
  it("formats amounts with exactly two decimals", () => {
    expect(formatAmount(65)).toBe("65.00")
    expect(formatAmount(12.5)).toBe("12.50")
    expect(formatAmount(0)).toBe("0.00")
  })

  it("prefixes CHF for totals", () => {
    expect(formatChf(65)).toBe("CHF 65.00")
    expect(formatChf(8, "EUR")).toBe("EUR 8.00")
  })
})

describe("formatKm", () => {
  it("formats one decimal with a unit", () => {
    expect(formatKm(12.5)).toBe("12.5 km")
    expect(formatKm(3)).toBe("3.0 km")
  })

  it("returns an en dash for null", () => {
    expect(formatKm(null)).toBe("–")
  })
})

describe("formatDateShort", () => {
  it("formats YYYY-MM-DD as Swiss dd.mm.yyyy without timezone shift", () => {
    expect(formatDateShort("2026-07-05")).toBe("05.07.2026")
    expect(formatDateShort("2026-12-31")).toBe("31.12.2026")
    expect(formatDateShort("2026-01-01")).toBe("01.01.2026")
  })
})

describe("sumAmounts", () => {
  it("sums non-null amounts and ignores nulls", () => {
    expect(sumAmounts([25, 25, 15])).toBe(65)
    expect(sumAmounts([25, null, 15])).toBe(40)
  })

  it("returns 0 for an empty list", () => {
    expect(sumAmounts([])).toBe(0)
  })

  it("rounds to two decimals to avoid float drift", () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3)
    expect(sumAmounts([10.005, 0.005])).toBe(10.01)
  })
})
