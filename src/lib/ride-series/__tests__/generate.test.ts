import { describe, it, expect } from "vitest"
import {
  generateDatesForSeries,
  expandDirections,
} from "../generate"
import type { SeriesForGeneration } from "../generate"

// ---------------------------------------------------------------------------
// expandDirections
// ---------------------------------------------------------------------------

describe("expandDirections", () => {
  it("returns ['outbound'] for outbound", () => {
    expect(expandDirections("outbound")).toEqual(["outbound"])
  })

  it("returns ['return'] for return", () => {
    expect(expandDirections("return")).toEqual(["return"])
  })

  it("returns ['outbound', 'return'] for both", () => {
    expect(expandDirections("both")).toEqual(["outbound", "return"])
  })
})

// ---------------------------------------------------------------------------
// generateDatesForSeries — daily
// ---------------------------------------------------------------------------

describe("generateDatesForSeries — daily", () => {
  it("generates every day in the range", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "daily",
      days_of_week: null,
      start_date: "2026-03-01",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-03-01", "2026-03-05")
    expect(dates).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ])
  })

  it("clamps to series start_date when fromDate is earlier", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "daily",
      days_of_week: null,
      start_date: "2026-03-03",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-03-01", "2026-03-05")
    expect(dates).toEqual(["2026-03-03", "2026-03-04", "2026-03-05"])
  })

  it("clamps to series end_date when toDate is later", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "daily",
      days_of_week: null,
      start_date: "2026-03-01",
      end_date: "2026-03-03",
    }
    const dates = generateDatesForSeries(series, "2026-03-01", "2026-03-10")
    expect(dates).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"])
  })

  it("returns empty when range is invalid", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "daily",
      days_of_week: null,
      start_date: "2026-04-01",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-03-01", "2026-03-10")
    expect(dates).toEqual([])
  })

  it("returns empty when series ended before fromDate", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "daily",
      days_of_week: null,
      start_date: "2026-01-01",
      end_date: "2026-02-01",
    }
    const dates = generateDatesForSeries(series, "2026-03-01", "2026-03-10")
    expect(dates).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// generateDatesForSeries — weekly
// ---------------------------------------------------------------------------

describe("generateDatesForSeries — weekly", () => {
  it("generates only on selected weekdays", () => {
    // 2026-03-02 is a Monday
    const series: SeriesForGeneration = {
      recurrence_type: "weekly",
      days_of_week: ["monday", "wednesday", "friday"],
      start_date: "2026-03-01",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-03-01", "2026-03-08")
    // Mar 1 = Sun (no), Mar 2 = Mon (yes), Mar 3 = Tue (no), Mar 4 = Wed (yes),
    // Mar 5 = Thu (no), Mar 6 = Fri (yes), Mar 7 = Sat (no), Mar 8 = Sun (no)
    expect(dates).toEqual(["2026-03-02", "2026-03-04", "2026-03-06"])
  })

  it("returns empty when no days_of_week set", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "weekly",
      days_of_week: [],
      start_date: "2026-03-01",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-03-01", "2026-03-08")
    expect(dates).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// generateDatesForSeries — biweekly
// ---------------------------------------------------------------------------

describe("generateDatesForSeries — biweekly", () => {
  it("generates only every other week matching start_date parity", () => {
    // 2026-03-02 is a Monday, ISO week 10
    const series: SeriesForGeneration = {
      recurrence_type: "biweekly",
      days_of_week: ["monday"],
      start_date: "2026-03-02",
      end_date: null,
    }
    // Generate for 4 weeks: should produce Mon of week 10 and week 12, skip 11 and 13
    const dates = generateDatesForSeries(series, "2026-03-02", "2026-03-29")
    // Week 10: Mon Mar 2 (yes)
    // Week 11: Mon Mar 9 (no - different parity)
    // Week 12: Mon Mar 16 (yes)
    // Week 13: Mon Mar 23 (no - different parity)
    expect(dates).toEqual(["2026-03-02", "2026-03-16"])
  })

  it("works with multiple days per week", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "biweekly",
      days_of_week: ["monday", "friday"],
      start_date: "2026-03-02", // Week 10
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-03-02", "2026-03-22")
    // Week 10 (even parity): Mon Mar 2 (yes), Fri Mar 6 (yes)
    // Week 11 (odd parity): skip
    // Week 12 (even parity): Mon Mar 16 (yes), Fri Mar 20 (yes)
    expect(dates).toEqual([
      "2026-03-02",
      "2026-03-06",
      "2026-03-16",
      "2026-03-20",
    ])
  })
})

// ---------------------------------------------------------------------------
// generateDatesForSeries — monthly
// ---------------------------------------------------------------------------

describe("generateDatesForSeries — monthly", () => {
  it("generates on the same day-of-month", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "monthly",
      days_of_week: null,
      start_date: "2026-01-15",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-01-01", "2026-04-30")
    expect(dates).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ])
  })

  it("skips months where the day does not exist (e.g., Feb 31)", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "monthly",
      days_of_week: null,
      start_date: "2026-01-31",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-01-01", "2026-06-30")
    // Jan 31 (yes), Feb 31 (no), Mar 31 (yes), Apr 31 (no), May 31 (yes), Jun 31 (no)
    expect(dates).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"])
  })

  it("handles Feb 29 in non-leap year", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "monthly",
      days_of_week: null,
      start_date: "2026-01-29",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-01-01", "2026-04-30")
    // Jan 29 (yes), Feb has 28 days in 2026 so Feb 29 (no), Mar 29 (yes), Apr 29 (yes)
    expect(dates).toEqual(["2026-01-29", "2026-03-29", "2026-04-29"])
  })

  it("clamps monthly dates to effective range", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "monthly",
      days_of_week: null,
      start_date: "2026-03-15",
      end_date: "2026-06-15",
    }
    const dates = generateDatesForSeries(series, "2026-04-01", "2026-12-31")
    // Effective: Apr 1 – Jun 15. Apr 15 (yes), May 15 (yes), Jun 15 (yes)
    expect(dates).toEqual(["2026-04-15", "2026-05-15", "2026-06-15"])
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("generateDatesForSeries — edge cases", () => {
  it("single day range", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "daily",
      days_of_week: null,
      start_date: "2026-03-05",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-03-05", "2026-03-05")
    expect(dates).toEqual(["2026-03-05"])
  })

  it("fromDate equals toDate outside series range returns empty", () => {
    const series: SeriesForGeneration = {
      recurrence_type: "daily",
      days_of_week: null,
      start_date: "2026-04-01",
      end_date: null,
    }
    const dates = generateDatesForSeries(series, "2026-03-05", "2026-03-05")
    expect(dates).toEqual([])
  })
})
