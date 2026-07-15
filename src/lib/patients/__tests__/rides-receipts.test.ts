import { describe, it, expect } from "vitest"

import {
  getEffectivePrice,
  buildActiveReceiptRideIds,
  metersToKm,
  buildRideRows,
  buildReceiptRows,
  isValidPeriod,
  filterRowsByPeriod,
  countUnreceiptedCompleted,
  getMonthBounds,
  parseYearMonth,
  formatMonthLabel,
  formatDateShort,
  formatChf,
  type RawPatientRide,
  type RawReceiptItem,
  type RawPatientReceipt,
  type PatientRideRow,
} from "../rides-receipts"

// -----------------------------------------------------------------------------
// Test fixtures
// -----------------------------------------------------------------------------

function makeRide(overrides: Partial<RawPatientRide> = {}): RawPatientRide {
  return {
    id: "ride-1",
    date: "2026-07-10",
    pickup_time: "09:00",
    direction: "outbound",
    status: "completed",
    distance_meters: 5400,
    calculated_price: 16,
    price_override: null,
    destination: { display_name: "USZ Zürich" },
    ...overrides,
  }
}

// -----------------------------------------------------------------------------
// getEffectivePrice
// -----------------------------------------------------------------------------

describe("getEffectivePrice", () => {
  it("prefers the override over the calculated price", () => {
    expect(getEffectivePrice(16, 20)).toBe(20)
  })

  it("falls back to the calculated price when no override", () => {
    expect(getEffectivePrice(16, null)).toBe(16)
  })

  it("returns null when neither price is set", () => {
    expect(getEffectivePrice(null, null)).toBeNull()
  })

  it("treats an override of 0 as a real value (not falling through)", () => {
    expect(getEffectivePrice(16, 0)).toBe(0)
  })
})

// -----------------------------------------------------------------------------
// buildActiveReceiptRideIds — quittiert-Kennzeichnung via is_cancelled=false
// -----------------------------------------------------------------------------

describe("buildActiveReceiptRideIds", () => {
  it("includes only ride ids from non-cancelled items", () => {
    const items: RawReceiptItem[] = [
      { ride_id: "a", is_cancelled: false },
      { ride_id: "b", is_cancelled: true },
      { ride_id: "c", is_cancelled: false },
    ]
    const ids = buildActiveReceiptRideIds(items)
    expect(ids.has("a")).toBe(true)
    expect(ids.has("c")).toBe(true)
    expect(ids.has("b")).toBe(false)
    expect(ids.size).toBe(2)
  })

  it("ignores items whose ride_id is null (ride deleted)", () => {
    const items: RawReceiptItem[] = [{ ride_id: null, is_cancelled: false }]
    expect(buildActiveReceiptRideIds(items).size).toBe(0)
  })

  it("a cancelled receipt's items make the ride quittierbar again", () => {
    // After a storno, the trigger flips is_cancelled to true for all items.
    const items: RawReceiptItem[] = [{ ride_id: "a", is_cancelled: true }]
    expect(buildActiveReceiptRideIds(items).has("a")).toBe(false)
  })

  it("returns an empty set for no items", () => {
    expect(buildActiveReceiptRideIds([]).size).toBe(0)
  })
})

// -----------------------------------------------------------------------------
// metersToKm
// -----------------------------------------------------------------------------

describe("metersToKm", () => {
  it("converts meters to km with one decimal", () => {
    expect(metersToKm(5400)).toBe(5.4)
    expect(metersToKm(12340)).toBe(12.3)
  })

  it("returns null for null input", () => {
    expect(metersToKm(null)).toBeNull()
  })

  it("handles zero", () => {
    expect(metersToKm(0)).toBe(0)
  })
})

// -----------------------------------------------------------------------------
// buildRideRows
// -----------------------------------------------------------------------------

describe("buildRideRows", () => {
  it("maps raw rides and marks receipted ones", () => {
    const rides = [
      makeRide({ id: "a" }),
      makeRide({ id: "b", price_override: 25 }),
    ]
    const rows = buildRideRows(rides, new Set(["a"]))

    expect(rows).toHaveLength(2)
    expect(rows[0]!.isReceipted).toBe(true)
    expect(rows[0]!.price).toBe(16)
    expect(rows[0]!.hasPrice).toBe(true)
    expect(rows[0]!.distanceKm).toBe(5.4)
    expect(rows[0]!.destinationName).toBe("USZ Zürich")

    expect(rows[1]!.isReceipted).toBe(false)
    expect(rows[1]!.price).toBe(25) // override wins
  })

  it("marks rides without any price as hasPrice=false", () => {
    const rows = buildRideRows(
      [makeRide({ calculated_price: null, price_override: null })],
      new Set()
    )
    expect(rows[0]!.hasPrice).toBe(false)
    expect(rows[0]!.price).toBeNull()
  })

  it("falls back to a dash when destination is missing", () => {
    const rows = buildRideRows([makeRide({ destination: null })], new Set())
    expect(rows[0]!.destinationName).toBe("–")
  })
})

// -----------------------------------------------------------------------------
// buildReceiptRows
// -----------------------------------------------------------------------------

describe("buildReceiptRows", () => {
  it("maps raw receipts to display rows", () => {
    const receipts: RawPatientReceipt[] = [
      {
        id: "r1",
        receipt_number: "Q-2026-00042",
        period_from: "2026-07-01",
        period_to: "2026-07-31",
        total_amount: 64,
        status: "issued",
        pdf_path: "receipts/2026/Q-2026-00042.pdf",
      },
    ]
    const rows = buildReceiptRows(receipts)
    expect(rows[0]).toEqual({
      id: "r1",
      receiptNumber: "Q-2026-00042",
      periodFrom: "2026-07-01",
      periodTo: "2026-07-31",
      totalAmount: 64,
      status: "issued",
      pdfPath: "receipts/2026/Q-2026-00042.pdf",
    })
  })
})

// -----------------------------------------------------------------------------
// isValidPeriod
// -----------------------------------------------------------------------------

describe("isValidPeriod", () => {
  it("accepts a well-formed, non-inverted range", () => {
    expect(isValidPeriod("2026-07-01", "2026-07-31")).toBe(true)
  })

  it("accepts an equal from/to (single day)", () => {
    expect(isValidPeriod("2026-07-10", "2026-07-10")).toBe(true)
  })

  it("rejects an inverted range", () => {
    expect(isValidPeriod("2026-07-31", "2026-07-01")).toBe(false)
  })

  it("rejects malformed dates", () => {
    expect(isValidPeriod("2026-7-1", "2026-07-31")).toBe(false)
    expect(isValidPeriod("", "2026-07-31")).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// filterRowsByPeriod — Zeitraumfilter
// -----------------------------------------------------------------------------

describe("filterRowsByPeriod", () => {
  const rows = buildRideRows(
    [
      makeRide({ id: "jun", date: "2026-06-30" }),
      makeRide({ id: "jul-start", date: "2026-07-01" }),
      makeRide({ id: "jul-mid", date: "2026-07-15" }),
      makeRide({ id: "jul-end", date: "2026-07-31" }),
      makeRide({ id: "aug", date: "2026-08-01" }),
    ],
    new Set()
  )

  it("includes rides on the inclusive boundaries", () => {
    const filtered = filterRowsByPeriod(rows, {
      from: "2026-07-01",
      to: "2026-07-31",
    })
    expect(filtered.map((r) => r.id)).toEqual([
      "jul-start",
      "jul-mid",
      "jul-end",
    ])
  })

  it("excludes rides outside the range", () => {
    const filtered = filterRowsByPeriod(rows, {
      from: "2026-07-01",
      to: "2026-07-31",
    })
    expect(filtered.some((r) => r.id === "jun")).toBe(false)
    expect(filtered.some((r) => r.id === "aug")).toBe(false)
  })

  it("supports a single-day period", () => {
    const filtered = filterRowsByPeriod(rows, {
      from: "2026-07-15",
      to: "2026-07-15",
    })
    expect(filtered.map((r) => r.id)).toEqual(["jul-mid"])
  })
})

// -----------------------------------------------------------------------------
// countUnreceiptedCompleted — drives "Quittung erstellen" visibility
// -----------------------------------------------------------------------------

describe("countUnreceiptedCompleted", () => {
  function row(overrides: Partial<PatientRideRow>): PatientRideRow {
    return {
      id: "x",
      date: "2026-07-10",
      pickupTime: "09:00",
      destinationName: "USZ",
      direction: "outbound",
      status: "completed",
      distanceKm: 5,
      price: 16,
      hasPrice: true,
      isReceipted: false,
      ...overrides,
    }
  }

  it("counts completed rides not on an active receipt", () => {
    const rows = [
      row({ id: "a" }),
      row({ id: "b" }),
      row({ id: "c", isReceipted: true }), // already receipted
      row({ id: "d", status: "cancelled" }), // not completed
      row({ id: "e", status: "planned" }), // not completed
    ]
    expect(countUnreceiptedCompleted(rows)).toBe(2)
  })

  it("counts unpriced completed rides too (they still block a clean receipt)", () => {
    const rows = [row({ hasPrice: false, price: null })]
    expect(countUnreceiptedCompleted(rows)).toBe(1)
  })

  it("returns 0 when everything is receipted or non-completed", () => {
    const rows = [
      row({ isReceipted: true }),
      row({ status: "no_show" }),
    ]
    expect(countUnreceiptedCompleted(rows)).toBe(0)
  })
})

// -----------------------------------------------------------------------------
// Month helpers
// -----------------------------------------------------------------------------

describe("getMonthBounds", () => {
  it("returns the first and last day of a 31-day month", () => {
    expect(getMonthBounds(2026, 6)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    })
  })

  it("handles February in a non-leap year", () => {
    expect(getMonthBounds(2026, 1)).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    })
  })

  it("handles February in a leap year", () => {
    expect(getMonthBounds(2028, 1)).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    })
  })

  it("normalises month overflow into the next year", () => {
    expect(getMonthBounds(2026, 12)).toEqual({
      from: "2027-01-01",
      to: "2027-01-31",
    })
  })

  it("normalises negative month into the previous year", () => {
    expect(getMonthBounds(2026, -1)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    })
  })
})

describe("parseYearMonth", () => {
  it("parses without timezone drift", () => {
    expect(parseYearMonth("2026-07-15")).toEqual({ year: 2026, month0: 6 })
    expect(parseYearMonth("2026-01-01")).toEqual({ year: 2026, month0: 0 })
  })
})

describe("formatMonthLabel", () => {
  it("formats a German month label", () => {
    expect(formatMonthLabel(2026, 6)).toBe("Juli 2026")
  })

  it("normalises overflow", () => {
    expect(formatMonthLabel(2026, 12)).toBe("Januar 2027")
  })
})

describe("formatDateShort", () => {
  it("formats YYYY-MM-DD as DD.MM.YYYY", () => {
    expect(formatDateShort("2026-07-15")).toBe("15.07.2026")
  })

  it("passes through malformed input unchanged", () => {
    expect(formatDateShort("n/a")).toBe("n/a")
  })
})

describe("formatChf", () => {
  it("formats with two decimals", () => {
    expect(formatChf(16)).toBe("CHF 16.00")
    expect(formatChf(12.5)).toBe("CHF 12.50")
  })
})
