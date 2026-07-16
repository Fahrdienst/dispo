import { describe, it, expect } from "vitest"

import {
  aggregateStatistics,
  dimensionBucket,
  formatStatisticsCsv,
  isStatDimension,
  monthBucket,
  quarterBucket,
  yearBucket,
  STAT_DIMENSIONS,
  type NormalizedStatRide,
  type StatDimension,
} from "../statistics"

// =============================================================================
// Helpers
// =============================================================================

function ride(overrides: Partial<NormalizedStatRide> = {}): NormalizedStatRide {
  return {
    date: overrides.date ?? "2026-02-10",
    driverId: overrides.driverId !== undefined ? overrides.driverId : "d1",
    driverName: overrides.driverName !== undefined ? overrides.driverName : "Muster, Anna",
    destinationId: overrides.destinationId ?? "dest1",
    destinationName:
      overrides.destinationName !== undefined ? overrides.destinationName : "USZ Zürich",
    patientId: overrides.patientId ?? "11111111-2222-3333-4444-555555555555",
    patientName: overrides.patientName !== undefined ? overrides.patientName : "Meier, Hans",
    tariffZone: overrides.tariffZone !== undefined ? overrides.tariffZone : "zone_1",
    direction: overrides.direction ?? "outbound",
    distanceMeters:
      overrides.distanceMeters !== undefined ? overrides.distanceMeters : 5000,
    distanceSource: overrides.distanceSource ?? "planned",
    durationSeconds:
      overrides.durationSeconds !== undefined ? overrides.durationSeconds : 900,
    price: overrides.price !== undefined ? overrides.price : 12,
  }
}

// =============================================================================
// Time bucketing
// =============================================================================

describe("time bucketing", () => {
  it("monthBucket produces a sortable key and German label", () => {
    expect(monthBucket("2026-03-15")).toEqual({ key: "2026-03", label: "März 2026" })
    expect(monthBucket("2026-12-01")).toEqual({ key: "2026-12", label: "Dezember 2026" })
  })

  it("quarterBucket maps months to quarters", () => {
    expect(quarterBucket("2026-01-31").key).toBe("2026-Q1")
    expect(quarterBucket("2026-03-31").key).toBe("2026-Q1")
    expect(quarterBucket("2026-04-01").key).toBe("2026-Q2")
    expect(quarterBucket("2026-07-15")).toEqual({ key: "2026-Q3", label: "Q3 2026" })
    expect(quarterBucket("2026-10-15").key).toBe("2026-Q4")
    expect(quarterBucket("2026-12-31").key).toBe("2026-Q4")
  })

  it("yearBucket uses the year as key and label", () => {
    expect(yearBucket("2025-06-30")).toEqual({ key: "2025", label: "2025" })
  })
})

// =============================================================================
// isStatDimension
// =============================================================================

describe("isStatDimension", () => {
  it("accepts every declared dimension", () => {
    for (const d of STAT_DIMENSIONS) {
      expect(isStatDimension(d)).toBe(true)
    }
  })

  it("rejects unknown strings", () => {
    expect(isStatDimension("weekday")).toBe(false)
    expect(isStatDimension("")).toBe(false)
    expect(isStatDimension("Month")).toBe(false)
  })
})

// =============================================================================
// dimensionBucket
// =============================================================================

describe("dimensionBucket", () => {
  it("buckets driver by id, falling back for null driver", () => {
    expect(dimensionBucket(ride({ driverId: "d9", driverName: "X, Y" }), "driver")).toEqual({
      key: "d9",
      label: "X, Y",
      exportLabel: "X, Y",
    })
    expect(dimensionBucket(ride({ driverId: null, driverName: null }), "driver")).toEqual({
      key: "__none",
      label: "Ohne Fahrer",
      exportLabel: "Ohne Fahrer",
    })
  })

  it("maps known zones to labels and unknown/empty to a fallback", () => {
    expect(dimensionBucket(ride({ tariffZone: "gemeinde" }), "zone").label).toBe(
      "Gemeinde Duebendorf"
    )
    expect(dimensionBucket(ride({ tariffZone: null }), "zone")).toEqual({
      key: "__unknown",
      label: "Unbekannt",
      exportLabel: "Unbekannt",
    })
    // A raw, unmapped zone string falls through to itself.
    expect(dimensionBucket(ride({ tariffZone: "sonderzone" }), "zone").label).toBe(
      "sonderzone"
    )
  })

  it("translates direction via the shared label map", () => {
    expect(dimensionBucket(ride({ direction: "return" }), "direction").label).toBe(
      "Rückfahrt"
    )
  })

  it("pseudonymizes the patient dimension in the export label only", () => {
    const b = dimensionBucket(
      ride({ patientId: "abcdef01-2222-3333-4444-555555555555", patientName: "Meier, Hans" }),
      "patient"
    )
    expect(b.label).toBe("Meier, Hans")
    expect(b.exportLabel).toBe("P-abcdef01")
    expect(b.exportLabel).not.toContain("Meier")
  })
})

// =============================================================================
// aggregateStatistics
// =============================================================================

describe("aggregateStatistics", () => {
  it("returns an empty result for no rides", () => {
    const result = aggregateStatistics([], "month")
    expect(result.rows).toEqual([])
    expect(result.summary.totalRides).toBe(0)
    expect(result.summary.rowCount).toBe(0)
  })

  it("aggregates all four metrics per bucket", () => {
    const result = aggregateStatistics(
      [
        ride({ date: "2026-02-01", distanceMeters: 5000, durationSeconds: 600, price: 12 }),
        ride({ date: "2026-02-20", distanceMeters: 3000, durationSeconds: 300, price: 8 }),
        ride({ date: "2026-03-05", distanceMeters: 10000, durationSeconds: 1200, price: 16 }),
      ],
      "month"
    )

    expect(result.rows).toHaveLength(2)
    const feb = result.rows.find((r) => r.key === "2026-02")
    expect(feb).toBeDefined()
    expect(feb?.rideCount).toBe(2)
    expect(feb?.totalKm).toBe(8) // (5000 + 3000) / 1000
    expect(feb?.totalDurationSeconds).toBe(900)
    expect(feb?.revenue).toBe(20)

    expect(result.summary.totalRides).toBe(3)
    expect(result.summary.totalKm).toBe(18) // 8 + 10
    expect(result.summary.totalRevenue).toBe(36)
  })

  it("sorts time dimensions chronologically ascending", () => {
    const result = aggregateStatistics(
      [
        ride({ date: "2026-03-01" }),
        ride({ date: "2026-01-01" }),
        ride({ date: "2026-02-01" }),
      ],
      "month"
    )
    expect(result.rows.map((r) => r.key)).toEqual(["2026-01", "2026-02", "2026-03"])
  })

  it("sorts non-time dimensions by ride count descending, label tiebreak", () => {
    const result = aggregateStatistics(
      [
        ride({ destinationId: "a", destinationName: "Alpha" }),
        ride({ destinationId: "b", destinationName: "Beta" }),
        ride({ destinationId: "b", destinationName: "Beta" }),
        ride({ destinationId: "c", destinationName: "Gamma" }),
      ],
      "destination"
    )
    // Beta (2) first, then Alpha/Gamma (1 each) alphabetically.
    expect(result.rows.map((r) => r.label)).toEqual(["Beta", "Alpha", "Gamma"])
  })

  it("counts backfill/estimate km separately from planned km", () => {
    const result = aggregateStatistics(
      [
        ride({ distanceMeters: 4000, distanceSource: "planned" }),
        ride({ distanceMeters: 6000, distanceSource: "backfill" }),
        ride({ distanceMeters: 2000, distanceSource: "estimate" }),
      ],
      "year"
    )
    const row = result.rows[0]
    expect(row?.totalKm).toBe(12) // 4 + 6 + 2
    expect(row?.backfillKm).toBe(8) // 6 (backfill) + 2 (estimate)
    expect(result.summary.backfillKm).toBe(8)
  })

  it("counts rides without any distance and excludes them from km", () => {
    const result = aggregateStatistics(
      [
        ride({ distanceMeters: 5000 }),
        ride({ distanceMeters: null }),
        ride({ distanceMeters: null }),
      ],
      "year"
    )
    const row = result.rows[0]
    expect(row?.rideCount).toBe(3)
    expect(row?.totalKm).toBe(5)
    expect(row?.ridesWithoutKm).toBe(2)
    expect(result.summary.ridesWithoutKm).toBe(2)
  })

  it("ignores null price and null duration without breaking the sum", () => {
    const result = aggregateStatistics(
      [
        ride({ price: 10, durationSeconds: 600 }),
        ride({ price: null, durationSeconds: null }),
      ],
      "year"
    )
    const row = result.rows[0]
    expect(row?.revenue).toBe(10)
    expect(row?.totalDurationSeconds).toBe(600)
    expect(row?.rideCount).toBe(2)
  })

  it("groups the direction dimension", () => {
    const result = aggregateStatistics(
      [
        ride({ direction: "outbound" }),
        ride({ direction: "outbound" }),
        ride({ direction: "return" }),
      ],
      "direction"
    )
    expect(result.rows).toHaveLength(2)
    const outbound = result.rows.find((r) => r.key === "outbound")
    expect(outbound?.label).toBe("Hinfahrt")
    expect(outbound?.rideCount).toBe(2)
  })
})

// =============================================================================
// formatStatisticsCsv
// =============================================================================

describe("formatStatisticsCsv", () => {
  it("emits BOM, a dynamic dimension header and a total row", () => {
    const result = aggregateStatistics(
      [
        ride({ date: "2026-02-01", distanceMeters: 5000, durationSeconds: 600, price: 12 }),
        ride({ date: "2026-02-20", distanceMeters: 3000, durationSeconds: 300, price: 8 }),
      ],
      "month"
    )
    const csv = formatStatisticsCsv(result)

    expect(csv.startsWith("﻿")).toBe(true)
    // `trim()` strips the leading BOM, so the header assertion is BOM-free.
    const lines = csv.trim().split("\n")
    expect(lines[0]).toBe(
      "Monat;Fahrten;km;davon nachberechnet (km);Fahrten ohne km;Fahrzeit (Min.);Umsatz (CHF)"
    )
    // One data row + total row.
    expect(lines).toHaveLength(3)
    expect(lines[2]).toBe("Total;2;8.0;0.0;0;15;20.00")
  })

  it("uses the pseudonymized export label for the patient dimension", () => {
    const result = aggregateStatistics(
      [ride({ patientId: "abcdef01-0000-0000-0000-000000000000", patientName: "Meier, Hans" })],
      "patient"
    )
    const csv = formatStatisticsCsv(result)
    expect(csv).toContain("P-abcdef01")
    expect(csv).not.toContain("Meier")
    expect(csv).toContain("﻿Patient;")
  })

  it("escapes semicolons and quotes in labels", () => {
    const result = aggregateStatistics(
      [ride({ destinationId: "x", destinationName: 'Klinik; "Sonne"' })],
      "destination"
    )
    const csv = formatStatisticsCsv(result)
    expect(csv).toContain('"Klinik; ""Sonne"""')
  })

  it("reports the non-planned km share in the total row", () => {
    const result = aggregateStatistics(
      [
        ride({ date: "2026-01-01", distanceMeters: 4000, distanceSource: "planned" }),
        ride({ date: "2026-01-02", distanceMeters: 6000, distanceSource: "backfill" }),
      ],
      "year"
    )
    const csv = formatStatisticsCsv(result)
    const lines = csv.trim().split("\n")
    // year row: 2026;2;10.0;6.0;0;30;24.00  (durations 900+900=1800s → 30 min)
    const totalLine = lines[lines.length - 1]
    expect(totalLine).toContain(";10.0;6.0;")
  })
})

// =============================================================================
// Dimension coverage — every dimension aggregates without throwing
// =============================================================================

describe("dimension coverage", () => {
  it("aggregates for every declared dimension", () => {
    const rides = [ride(), ride({ date: "2026-05-01", direction: "return" })]
    for (const dimension of STAT_DIMENSIONS as readonly StatDimension[]) {
      const result = aggregateStatistics(rides, dimension)
      expect(result.dimension).toBe(dimension)
      expect(result.summary.totalRides).toBe(2)
    }
  })
})
