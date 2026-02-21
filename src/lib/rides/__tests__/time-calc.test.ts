import { describe, it, expect } from "vitest"
import {
  calculateRideTimes,
  DEFAULT_PICKUP_BUFFER_MINUTES,
} from "../time-calc"

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
