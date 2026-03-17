import { describe, it, expect } from "vitest"
import {
  calculateRideTimes,
  detectTimeConflicts,
  DEFAULT_PICKUP_BUFFER_MINUTES,
} from "../time-calc"
import type { ConflictRideInput } from "../time-calc"

describe("calculateRideTimes", () => {
  // -------------------------------------------------------------------------
  // Outbound pickup time
  // -------------------------------------------------------------------------

  describe("suggestedPickupTime", () => {
    it("calculates normal outbound pickup: 09:30 - 20min drive - 5min buffer = 09:05", () => {
      const result = calculateRideTimes({
        appointment_time: "09:30",
        appointment_end_time: null,
        duration_seconds: 1200, // 20 minutes
      })
      expect(result.suggestedPickupTime).toBe("09:05")
    })

    it("returns null when result goes before 00:00 (midnight boundary)", () => {
      const result = calculateRideTimes({
        appointment_time: "00:15",
        appointment_end_time: null,
        duration_seconds: 2700, // 45 minutes
      })
      // 00:15 - 45min - 5min buffer = -35min → null
      expect(result.suggestedPickupTime).toBeNull()
    })

    it("returns null when appointment_time is null", () => {
      const result = calculateRideTimes({
        appointment_time: null,
        appointment_end_time: null,
        duration_seconds: 600,
      })
      expect(result.suggestedPickupTime).toBeNull()
    })

    it("returns null when duration_seconds is null", () => {
      const result = calculateRideTimes({
        appointment_time: "09:30",
        appointment_end_time: null,
        duration_seconds: null,
      })
      expect(result.suggestedPickupTime).toBeNull()
    })

    it("uses custom pickupBufferMinutes", () => {
      const result = calculateRideTimes({
        appointment_time: "10:00",
        appointment_end_time: null,
        duration_seconds: 600, // 10 minutes
        pickupBufferMinutes: 10,
      })
      // 10:00 - 10min drive - 10min buffer = 09:40
      expect(result.suggestedPickupTime).toBe("09:40")
    })

    it("rounds duration_seconds up to the next full minute", () => {
      const result = calculateRideTimes({
        appointment_time: "10:00",
        appointment_end_time: null,
        duration_seconds: 61, // 1 minute 1 second → ceil = 2 minutes
      })
      // 10:00 - 2min drive - 5min buffer = 09:53
      expect(result.suggestedPickupTime).toBe("09:53")
    })

    it("handles exact minute duration without rounding", () => {
      const result = calculateRideTimes({
        appointment_time: "10:00",
        appointment_end_time: null,
        duration_seconds: 60, // exactly 1 minute
      })
      // 10:00 - 1min drive - 5min buffer = 09:54
      expect(result.suggestedPickupTime).toBe("09:54")
    })

    it("handles zero duration", () => {
      const result = calculateRideTimes({
        appointment_time: "10:00",
        appointment_end_time: null,
        duration_seconds: 0,
      })
      // 10:00 - 0min drive - 5min buffer = 09:55
      expect(result.suggestedPickupTime).toBe("09:55")
    })
  })

  // -------------------------------------------------------------------------
  // Return pickup time
  // -------------------------------------------------------------------------

  describe("suggestedReturnPickupTime", () => {
    it("calculates return pickup: 10:00 + 15min buffer = 10:15", () => {
      const result = calculateRideTimes({
        appointment_time: null,
        appointment_end_time: "10:00",
        duration_seconds: null,
      })
      expect(result.suggestedReturnPickupTime).toBe("10:15")
    })

    it("returns null when result exceeds 23:59 (overflow)", () => {
      const result = calculateRideTimes({
        appointment_time: null,
        appointment_end_time: "23:50",
        duration_seconds: null,
      })
      // 23:50 + 15min = 24:05 → null
      expect(result.suggestedReturnPickupTime).toBeNull()
    })

    it("returns null when appointment_end_time is null", () => {
      const result = calculateRideTimes({
        appointment_time: null,
        appointment_end_time: null,
        duration_seconds: null,
      })
      expect(result.suggestedReturnPickupTime).toBeNull()
    })

    it("uses custom returnBufferMinutes", () => {
      const result = calculateRideTimes({
        appointment_time: null,
        appointment_end_time: "14:00",
        duration_seconds: null,
        returnBufferMinutes: 30,
      })
      // 14:00 + 30min = 14:30
      expect(result.suggestedReturnPickupTime).toBe("14:30")
    })

    it("handles boundary: 23:45 + 14min = 23:59 (still valid)", () => {
      const result = calculateRideTimes({
        appointment_time: null,
        appointment_end_time: "23:45",
        duration_seconds: null,
        returnBufferMinutes: 14,
      })
      expect(result.suggestedReturnPickupTime).toBe("23:59")
    })
  })

  // -------------------------------------------------------------------------
  // Combined (both directions)
  // -------------------------------------------------------------------------

  describe("combined outbound + return", () => {
    it("calculates both pickup times from full inputs", () => {
      const result = calculateRideTimes({
        appointment_time: "09:00",
        appointment_end_time: "10:00",
        duration_seconds: 900, // 15 minutes
      })
      // Outbound: 09:00 - 15min drive - 5min buffer = 08:40
      expect(result.suggestedPickupTime).toBe("08:40")
      // Return: 10:00 + 15min buffer = 10:15
      expect(result.suggestedReturnPickupTime).toBe("10:15")
    })

    it("returns both null when all inputs are null", () => {
      const result = calculateRideTimes({
        appointment_time: null,
        appointment_end_time: null,
        duration_seconds: null,
      })
      expect(result.suggestedPickupTime).toBeNull()
      expect(result.suggestedReturnPickupTime).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Default constants
  // -------------------------------------------------------------------------

  describe("constants", () => {
    it("exports DEFAULT_PICKUP_BUFFER_MINUTES as 5", () => {
      expect(DEFAULT_PICKUP_BUFFER_MINUTES).toBe(5)
    })
  })
})

// ---------------------------------------------------------------------------
// detectTimeConflicts
// ---------------------------------------------------------------------------

describe("detectTimeConflicts", () => {
  const makeRide = (
    overrides: Partial<ConflictRideInput> & { id: string; pickup_time: string }
  ): ConflictRideInput => ({
    driver_id: "driver-1",
    duration_seconds: 1800, // 30 minutes
    status: "confirmed",
    ...overrides,
  })

  // ---- No conflicts ----

  it("returns empty array when there are no rides", () => {
    expect(detectTimeConflicts([])).toEqual([])
  })

  it("returns empty array for a single ride", () => {
    const rides = [makeRide({ id: "r1", pickup_time: "08:00" })]
    expect(detectTimeConflicts(rides)).toEqual([])
  })

  it("returns empty array when rides do not overlap", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", duration_seconds: 1800 }), // 08:00-08:30
      makeRide({ id: "r2", pickup_time: "09:00", duration_seconds: 1800 }), // 09:00-09:30
    ]
    expect(detectTimeConflicts(rides)).toEqual([])
  })

  it("returns empty array when rides are back-to-back (no gap, no overlap)", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", duration_seconds: 3600 }), // 08:00-09:00
      makeRide({ id: "r2", pickup_time: "09:00", duration_seconds: 1800 }), // 09:00-09:30
    ]
    // currentEnd (09:00) is NOT > nextStart (09:00) → no conflict
    expect(detectTimeConflicts(rides)).toEqual([])
  })

  // ---- Overlapping rides ----

  it("detects overlap between two rides of the same driver", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", duration_seconds: 3600 }), // 08:00-09:00
      makeRide({ id: "r2", pickup_time: "08:30", duration_seconds: 1800 }), // 08:30-09:00
    ]
    const conflicts = detectTimeConflicts(rides)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      rideIdA: "r1",
      rideIdB: "r2",
      driverId: "driver-1",
      overlapStart: "08:30",
      overlapEnd: "09:00",
    })
  })

  it("detects overlap when rides have the exact same time", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "10:00", duration_seconds: 1800 }),
      makeRide({ id: "r2", pickup_time: "10:00", duration_seconds: 1800 }),
    ]
    const conflicts = detectTimeConflicts(rides)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      rideIdA: "r1",
      rideIdB: "r2",
      driverId: "driver-1",
    })
  })

  // ---- Different drivers ----

  it("does not flag overlap between different drivers", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", driver_id: "driver-1", duration_seconds: 3600 }),
      makeRide({ id: "r2", pickup_time: "08:30", driver_id: "driver-2", duration_seconds: 1800 }),
    ]
    expect(detectTimeConflicts(rides)).toEqual([])
  })

  // ---- Excluded statuses ----

  it("excludes cancelled rides from conflict detection", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", duration_seconds: 3600 }),
      makeRide({ id: "r2", pickup_time: "08:30", status: "cancelled", duration_seconds: 1800 }),
    ]
    expect(detectTimeConflicts(rides)).toEqual([])
  })

  it("excludes no_show rides from conflict detection", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", duration_seconds: 3600 }),
      makeRide({ id: "r2", pickup_time: "08:30", status: "no_show", duration_seconds: 1800 }),
    ]
    expect(detectTimeConflicts(rides)).toEqual([])
  })

  // ---- Unassigned rides ----

  it("excludes rides without a driver_id", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", driver_id: null, duration_seconds: 3600 }),
      makeRide({ id: "r2", pickup_time: "08:30", driver_id: null, duration_seconds: 1800 }),
    ]
    expect(detectTimeConflicts(rides)).toEqual([])
  })

  // ---- Null duration fallback ----

  it("uses 60-minute default when duration_seconds is null", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", duration_seconds: null }), // 08:00-09:00 (60min default)
      makeRide({ id: "r2", pickup_time: "08:50", duration_seconds: 600 }),  // 08:50-09:00
    ]
    const conflicts = detectTimeConflicts(rides)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      overlapStart: "08:50",
      overlapEnd: "09:00",
    })
  })

  // ---- Multiple conflicts ----

  it("detects multiple consecutive conflicts for the same driver", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", duration_seconds: 3600 }), // 08:00-09:00
      makeRide({ id: "r2", pickup_time: "08:30", duration_seconds: 3600 }), // 08:30-09:30
      makeRide({ id: "r3", pickup_time: "09:00", duration_seconds: 1800 }), // 09:00-09:30
    ]
    const conflicts = detectTimeConflicts(rides)
    // r1 vs r2 overlap, r2 vs r3 overlap
    expect(conflicts).toHaveLength(2)
    expect(conflicts[0]!.rideIdA).toBe("r1")
    expect(conflicts[0]!.rideIdB).toBe("r2")
    expect(conflicts[1]!.rideIdA).toBe("r2")
    expect(conflicts[1]!.rideIdB).toBe("r3")
  })

  // ---- Mixed drivers ----

  it("handles conflicts across multiple drivers independently", () => {
    const rides = [
      makeRide({ id: "r1", pickup_time: "08:00", driver_id: "driver-1", duration_seconds: 3600 }),
      makeRide({ id: "r2", pickup_time: "08:30", driver_id: "driver-1", duration_seconds: 1800 }),
      makeRide({ id: "r3", pickup_time: "10:00", driver_id: "driver-2", duration_seconds: 3600 }),
      makeRide({ id: "r4", pickup_time: "10:30", driver_id: "driver-2", duration_seconds: 1800 }),
    ]
    const conflicts = detectTimeConflicts(rides)
    expect(conflicts).toHaveLength(2)
    expect(conflicts[0]!.driverId).toBe("driver-1")
    expect(conflicts[1]!.driverId).toBe("driver-2")
  })
})
