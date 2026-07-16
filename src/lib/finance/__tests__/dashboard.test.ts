import { describe, it, expect } from "vitest"

import {
  averagePrice,
  buildChartSeries,
  buildKpis,
  buildMonthTimeline,
  computeDelta,
  firstOfMonth,
  formatChf,
  formatDeltaPct,
  formatInt,
  formatKm,
  formatMonthLabel,
  indexMonthlyStats,
  shiftMonth,
  sortTopList,
  type MonthlyStat,
  type TopListItem,
} from "../dashboard"

// =============================================================================
// Month arithmetic
// =============================================================================

describe("firstOfMonth", () => {
  it("collapses a date to the first of its month", () => {
    expect(firstOfMonth("2026-07-16")).toBe("2026-07-01")
    expect(firstOfMonth("2026-01-31")).toBe("2026-01-01")
  })
})

describe("shiftMonth", () => {
  it("shifts forward and backward within a year", () => {
    expect(shiftMonth("2026-07-01", -1)).toBe("2026-06-01")
    expect(shiftMonth("2026-07-01", 2)).toBe("2026-09-01")
  })

  it("crosses year boundaries in both directions", () => {
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01")
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01")
    expect(shiftMonth("2026-07-01", -12)).toBe("2025-07-01")
    expect(shiftMonth("2026-02-01", -13)).toBe("2025-01-01")
  })
})

describe("buildMonthTimeline", () => {
  it("builds an inclusive oldest-first timeline ending at the anchor", () => {
    expect(buildMonthTimeline("2026-03-01", 4)).toEqual([
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ])
  })

  it("returns just the anchor for a count of 1", () => {
    expect(buildMonthTimeline("2026-07-01", 1)).toEqual(["2026-07-01"])
  })

  it("spans 24 months for the dashboard window", () => {
    const timeline = buildMonthTimeline("2026-07-01", 24)
    expect(timeline).toHaveLength(24)
    expect(timeline[0]).toBe("2024-08-01")
    expect(timeline[23]).toBe("2026-07-01")
  })
})

describe("formatMonthLabel", () => {
  it("formats a German short label with a 2-digit year", () => {
    expect(formatMonthLabel("2026-02-01")).toBe("Feb 26")
    expect(formatMonthLabel("2025-12-01")).toBe("Dez 25")
  })
})

// =============================================================================
// averagePrice / computeDelta
// =============================================================================

describe("averagePrice", () => {
  it("divides revenue by ride count, rounded to 2 decimals", () => {
    expect(averagePrice(100, 8)).toBe(12.5)
    expect(averagePrice(10, 3)).toBe(3.33)
  })

  it("returns 0 for zero rides (no divide-by-zero)", () => {
    expect(averagePrice(0, 0)).toBe(0)
    expect(averagePrice(50, 0)).toBe(0)
  })
})

describe("computeDelta", () => {
  it("computes a positive percentage change", () => {
    expect(computeDelta(120, 100)).toEqual({ pct: 20, direction: "up" })
  })

  it("computes a negative percentage change", () => {
    expect(computeDelta(80, 100)).toEqual({ pct: -20, direction: "down" })
  })

  it("reports flat when unchanged", () => {
    expect(computeDelta(100, 100)).toEqual({ pct: 0, direction: "flat" })
  })

  it("returns a null percentage when the comparison base is zero", () => {
    // A from-zero jump has no finite percentage → rendered as "—".
    expect(computeDelta(50, 0)).toEqual({ pct: null, direction: "up" })
    expect(computeDelta(0, 0)).toEqual({ pct: null, direction: "flat" })
  })

  it("rounds the percentage to two decimals", () => {
    expect(computeDelta(1, 3).pct).toBe(-66.67)
  })
})

// =============================================================================
// buildKpis
// =============================================================================

function stat(overrides: Partial<MonthlyStat> & { month: string }): MonthlyStat {
  return {
    rideCount: overrides.rideCount ?? 0,
    revenue: overrides.revenue ?? 0,
    totalMeters: overrides.totalMeters ?? 0,
    month: overrides.month,
  }
}

describe("buildKpis", () => {
  it("derives current-month values with both comparison deltas", () => {
    const stats = indexMonthlyStats([
      stat({ month: "2026-07-01", rideCount: 100, revenue: 1200, totalMeters: 500000 }),
      stat({ month: "2026-06-01", rideCount: 80, revenue: 1000, totalMeters: 400000 }),
      stat({ month: "2025-07-01", rideCount: 50, revenue: 600, totalMeters: 250000 }),
    ])

    const kpis = buildKpis(stats, "2026-07-01")

    expect(kpis.revenue.value).toBe(1200)
    expect(kpis.revenue.vsPreviousMonth).toEqual({ pct: 20, direction: "up" })
    expect(kpis.revenue.vsPreviousYear).toEqual({ pct: 100, direction: "up" })

    expect(kpis.rides.value).toBe(100)
    expect(kpis.rides.vsPreviousMonth).toEqual({ pct: 25, direction: "up" })

    // 500000 m → 500 km, 400000 m → 400 km → +25 %
    expect(kpis.km.value).toBe(500)
    expect(kpis.km.vsPreviousMonth).toEqual({ pct: 25, direction: "up" })

    // avg = 1200 / 100 = 12; prev = 1000 / 80 = 12.5 → -4 %
    expect(kpis.avgPrice.value).toBe(12)
    expect(kpis.avgPrice.vsPreviousMonth).toEqual({ pct: -4, direction: "down" })
  })

  it("treats missing comparison months as empty (null deltas)", () => {
    const stats = indexMonthlyStats([
      stat({ month: "2026-07-01", rideCount: 10, revenue: 100, totalMeters: 20000 }),
    ])

    const kpis = buildKpis(stats, "2026-07-01")

    expect(kpis.revenue.value).toBe(100)
    expect(kpis.revenue.vsPreviousMonth.pct).toBeNull()
    expect(kpis.revenue.vsPreviousYear.pct).toBeNull()
    expect(kpis.rides.vsPreviousYear.pct).toBeNull()
  })

  it("yields all-zero KPIs when the current month is empty", () => {
    const kpis = buildKpis(new Map(), "2026-07-01")
    expect(kpis.revenue.value).toBe(0)
    expect(kpis.rides.value).toBe(0)
    expect(kpis.km.value).toBe(0)
    expect(kpis.avgPrice.value).toBe(0)
    expect(kpis.revenue.vsPreviousMonth.pct).toBeNull()
  })
})

// =============================================================================
// buildChartSeries
// =============================================================================

describe("buildChartSeries", () => {
  it("fills empty months with zeros across the timeline", () => {
    const stats = indexMonthlyStats([
      stat({ month: "2026-02-01", rideCount: 5, revenue: 60, totalMeters: 12000 }),
    ])
    const timeline = ["2026-01-01", "2026-02-01", "2026-03-01"]

    const series = buildChartSeries(stats, timeline)

    expect(series).toHaveLength(3)
    expect(series[0]).toMatchObject({ month: "2026-01-01", revenue: 0, km: 0, rideCount: 0 })
    expect(series[1]).toMatchObject({ month: "2026-02-01", revenue: 60, km: 12, rideCount: 5 })
    expect(series[2]).toMatchObject({ month: "2026-03-01", revenue: 0, km: 0, rideCount: 0 })
  })

  it("attaches the prior-year revenue from the wider window", () => {
    const stats = indexMonthlyStats([
      stat({ month: "2026-07-01", revenue: 1200 }),
      stat({ month: "2025-07-01", revenue: 600 }),
    ])
    const timeline = ["2026-07-01"]

    const [point] = buildChartSeries(stats, timeline)
    expect(point?.revenue).toBe(1200)
    expect(point?.priorYearRevenue).toBe(600)
  })

  it("uses 0 as prior-year revenue when that month is missing", () => {
    const stats = indexMonthlyStats([stat({ month: "2026-07-01", revenue: 1200 })])
    const [point] = buildChartSeries(stats, ["2026-07-01"])
    expect(point?.priorYearRevenue).toBe(0)
  })
})

// =============================================================================
// sortTopList
// =============================================================================

describe("sortTopList", () => {
  const items: TopListItem[] = [
    { id: "a", label: "Alpha", count: 3 },
    { id: "b", label: "Bravo", count: 10 },
    { id: "c", label: "Charlie", count: 3 },
    { id: "d", label: "Delta", count: 7 },
  ]

  it("orders by count descending", () => {
    const sorted = sortTopList(items, 10)
    expect(sorted.map((i) => i.id)).toEqual(["b", "d", "a", "c"])
  })

  it("breaks ties by label (de-CH)", () => {
    const sorted = sortTopList(items, 10)
    // "Alpha" before "Charlie" at count 3.
    expect(sorted.slice(2).map((i) => i.label)).toEqual(["Alpha", "Charlie"])
  })

  it("truncates to the requested limit", () => {
    expect(sortTopList(items, 2).map((i) => i.id)).toEqual(["b", "d"])
  })

  it("does not mutate the input array", () => {
    const input = [...items]
    sortTopList(input, 2)
    expect(input).toEqual(items)
  })
})

// =============================================================================
// Formatting (de-CH)
// =============================================================================

describe("formatters", () => {
  it("formats CHF with apostrophe grouping and 2 decimals", () => {
    expect(formatChf(1234.5)).toBe("1'234.50")
    expect(formatChf(0)).toBe("0.00")
  })

  it("formats integers with grouping", () => {
    expect(formatInt(1234)).toBe("1'234")
    expect(formatInt(0)).toBe("0")
  })

  it("formats km with one decimal", () => {
    expect(formatKm(1234.5)).toBe("1'234.5")
  })

  it("formats a delta percentage with an explicit sign", () => {
    expect(formatDeltaPct({ pct: 12.3, direction: "up" })).toBe("+12.3 %")
    expect(formatDeltaPct({ pct: -4, direction: "down" })).toBe("-4.0 %")
    expect(formatDeltaPct({ pct: 0, direction: "flat" })).toBe("0.0 %")
  })

  it("renders an em dash for an incomparable delta", () => {
    expect(formatDeltaPct({ pct: null, direction: "up" })).toBe("—")
  })
})
