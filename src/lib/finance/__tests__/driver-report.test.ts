import { describe, it, expect } from "vitest"

import {
  aggregateDriverReport,
  calculateCompensation,
  formatDriverReportCsv,
  metersToKm,
  round2,
  type CompensationRates,
  type NormalizedRide,
} from "../driver-report"

// =============================================================================
// Helpers
// =============================================================================

function ride(overrides: Partial<NormalizedRide> = {}): NormalizedRide {
  return {
    rideId: overrides.rideId ?? "r1",
    driverId: overrides.driverId ?? "d1",
    driverName: overrides.driverName ?? "Muster, Anna",
    date: overrides.date ?? "2026-02-10",
    destinationName:
      overrides.destinationName !== undefined
        ? overrides.destinationName
        : "USZ Zürich",
    distanceMeters:
      overrides.distanceMeters !== undefined ? overrides.distanceMeters : 5000,
    durationSeconds:
      overrides.durationSeconds !== undefined ? overrides.durationSeconds : 900,
    price: overrides.price !== undefined ? overrides.price : 12,
  }
}

const RATES: CompensationRates = { perRideChf: 5, perKmChf: 0.7 }

// =============================================================================
// round2 / metersToKm
// =============================================================================

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(8.644)).toBe(8.64)
    expect(round2(8.645)).toBe(8.65)
  })
})

describe("metersToKm", () => {
  it("converts meters to km rounded to one decimal", () => {
    expect(metersToKm(0)).toBe(0)
    expect(metersToKm(1000)).toBe(1)
    expect(metersToKm(1234)).toBe(1.2)
    expect(metersToKm(1250)).toBe(1.3)
    expect(metersToKm(12345)).toBe(12.3)
  })
})

// =============================================================================
// calculateCompensation
// =============================================================================

describe("calculateCompensation", () => {
  it("combines flat rate and km rate", () => {
    // 3 rides × 5 + 10 km × 0.70 = 15 + 7 = 22
    expect(calculateCompensation(3, 10, RATES)).toBe(22)
  })

  it("treats a null flat rate as CHF 0 (only km counts)", () => {
    // 0 + 20 km × 0.70 = 14
    expect(
      calculateCompensation(4, 20, { perRideChf: null, perKmChf: 0.7 })
    ).toBe(14)
  })

  it("treats a null km rate as CHF 0 (only flat counts)", () => {
    // 4 × 5 + 0 = 20
    expect(
      calculateCompensation(4, 20, { perRideChf: 5, perKmChf: null })
    ).toBe(20)
  })

  it("returns 0 when both rates are unconfigured", () => {
    expect(
      calculateCompensation(10, 100, { perRideChf: null, perKmChf: null })
    ).toBe(0)
  })

  it("returns 0 for a driver with no rides and no km", () => {
    expect(calculateCompensation(0, 0, RATES)).toBe(0)
  })

  it("rounds the money result to two decimals", () => {
    // 1 × 0 + 12.3 km × 0.70 = 8.61
    expect(
      calculateCompensation(1, 12.3, { perRideChf: 0, perKmChf: 0.7 })
    ).toBe(8.61)
  })

  it("is reproducible from the rounded km shown in the table", () => {
    // 12345 m → 12.3 km (rounded), 12.3 × 0.70 = 8.61 — not 8.6415 from raw m.
    const km = metersToKm(12345)
    expect(calculateCompensation(0, km, { perRideChf: 0, perKmChf: 0.7 })).toBe(
      8.61
    )
  })
})

// =============================================================================
// aggregateDriverReport
// =============================================================================

describe("aggregateDriverReport", () => {
  it("returns an empty result for no rides", () => {
    const result = aggregateDriverReport([], RATES)
    expect(result.rows).toEqual([])
    expect(result.details).toEqual({})
    expect(result.summary.driverCount).toBe(0)
    expect(result.summary.totalRides).toBe(0)
    expect(result.summary.totalCompensation).toBe(0)
  })

  it("groups rides per driver and computes totals", () => {
    const rides: NormalizedRide[] = [
      ride({ rideId: "r1", driverId: "d1", distanceMeters: 5000, price: 12 }),
      ride({ rideId: "r2", driverId: "d1", distanceMeters: 5000, price: 8 }),
    ]
    const { rows, summary } = aggregateDriverReport(rides, RATES)

    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.rideCount).toBe(2)
    expect(row.totalKm).toBe(10) // 10000 m → 10 km
    expect(row.revenue).toBe(20)
    // 2 × 5 + 10 × 0.70 = 17
    expect(row.compensation).toBe(17)
    expect(summary.totalRides).toBe(2)
    expect(summary.totalRevenue).toBe(20)
    expect(summary.totalCompensation).toBe(17)
    expect(summary.driverCount).toBe(1)
  })

  it("sorts drivers by name (de-CH)", () => {
    const rides: NormalizedRide[] = [
      ride({ rideId: "r1", driverId: "d2", driverName: "Zünd, Beat" }),
      ride({ rideId: "r2", driverId: "d1", driverName: "Ärni, Carla" }),
      ride({ rideId: "r3", driverId: "d3", driverName: "Meier, Tom" }),
    ]
    const { rows } = aggregateDriverReport(rides, RATES)
    expect(rows.map((r) => r.driverName)).toEqual([
      "Ärni, Carla",
      "Meier, Tom",
      "Zünd, Beat",
    ])
  })

  it("counts rides without km and excludes them from the distance sum", () => {
    const rides: NormalizedRide[] = [
      ride({ rideId: "r1", distanceMeters: 5000 }),
      ride({ rideId: "r2", distanceMeters: null }),
    ]
    const { rows, summary } = aggregateDriverReport(rides, RATES)
    const row = rows[0]!
    expect(row.totalKm).toBe(5) // only the 5000 m ride
    expect(row.ridesWithoutKm).toBe(1)
    // 2 rides × 5 + 5 km × 0.70 = 13.5
    expect(row.compensation).toBe(13.5)
    expect(summary.ridesWithoutKm).toBe(1)
  })

  it("counts rides without a price and excludes them from revenue", () => {
    const rides: NormalizedRide[] = [
      ride({ rideId: "r1", price: 12 }),
      ride({ rideId: "r2", price: null }),
    ]
    const { rows, summary } = aggregateDriverReport(rides, RATES)
    const row = rows[0]!
    expect(row.revenue).toBe(12)
    expect(row.ridesWithoutPrice).toBe(1)
    expect(summary.ridesWithoutPrice).toBe(1)
  })

  it("builds drill-down details per driver with rounded km and price", () => {
    const rides: NormalizedRide[] = [
      ride({
        rideId: "r1",
        driverId: "d1",
        date: "2026-02-01",
        destinationName: "Klinik A",
        distanceMeters: 12345,
        price: 12.5,
      }),
      ride({
        rideId: "r2",
        driverId: "d1",
        date: "2026-02-02",
        destinationName: null,
        distanceMeters: null,
        price: null,
      }),
    ]
    const { details } = aggregateDriverReport(rides, RATES)
    const list = details["d1"]!
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({
      rideId: "r1",
      destinationName: "Klinik A",
      distanceKm: 12.3,
      price: 12.5,
    })
    expect(list[1]).toMatchObject({
      rideId: "r2",
      destinationName: null,
      distanceKm: null,
      price: null,
    })
  })

  it("sums already-rounded rows so the total matches the visible columns", () => {
    // Two drivers each 1234 m → 1.2 km rounded; total column should be 2.4,
    // not round(2468/1000)=2.5.
    const rides: NormalizedRide[] = [
      ride({ rideId: "r1", driverId: "d1", driverName: "A", distanceMeters: 1234 }),
      ride({ rideId: "r2", driverId: "d2", driverName: "B", distanceMeters: 1234 }),
    ]
    const { summary } = aggregateDriverReport(rides, {
      perRideChf: 0,
      perKmChf: 0,
    })
    expect(summary.totalKm).toBe(2.4)
  })
})

// =============================================================================
// formatDriverReportCsv (SEC-M14-009: aggregate-only)
// =============================================================================

describe("formatDriverReportCsv", () => {
  function buildCsv(): string {
    const rides: NormalizedRide[] = [
      ride({
        rideId: "r1",
        driverId: "d1",
        driverName: "Muster, Anna",
        destinationName: "USZ Zürich",
        distanceMeters: 5000,
        durationSeconds: 900,
        price: 12,
      }),
    ]
    const { rows, summary } = aggregateDriverReport(rides, RATES)
    return formatDriverReportCsv(rows, summary)
  }

  it("starts with a UTF-8 BOM and a semicolon header", () => {
    const csv = buildCsv()
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const header = csv.slice(1).split("\n")[0]!
    expect(header).toBe(
      "Fahrer;Fahrten;km;Einsatzzeit (Min.);Einnahmen (CHF);Entschaedigung (CHF)"
    )
  })

  it("emits only aggregate columns — no destination or patient data", () => {
    const csv = buildCsv()
    // The drill-down destination must NEVER appear in the export.
    expect(csv).not.toContain("USZ")
    expect(csv).not.toContain("Ziel")
    expect(csv).not.toContain("Patient")
  })

  it("writes a data row with dot decimals for CHF and integer minutes", () => {
    const csv = buildCsv()
    const lines = csv.slice(1).split("\n")
    // 1 ride, 5.0 km, 900s → 15 min, revenue 12.00, comp = 5 + 5×0.7 = 8.50
    expect(lines[1]).toBe("Muster, Anna;1;5.0;15;12.00;8.50")
  })

  it("appends a summary row with the totals", () => {
    const csv = buildCsv()
    const lines = csv.slice(1).trimEnd().split("\n")
    const summaryLine = lines[lines.length - 1]!
    expect(summaryLine).toBe("Total: 1 Fahrer;1;5.0;15;12.00;8.50")
  })

  it("escapes a driver name containing a semicolon", () => {
    const rides: NormalizedRide[] = [
      ride({ driverName: "Foo; Bar", distanceMeters: 0, price: 0 }),
    ]
    const { rows, summary } = aggregateDriverReport(rides, {
      perRideChf: 0,
      perKmChf: 0,
    })
    const csv = formatDriverReportCsv(rows, summary)
    expect(csv).toContain('"Foo; Bar"')
  })
})
