import { describe, it, expect } from "vitest"
import {
  formatRemaining,
  deadlineStageLabel,
} from "@/lib/dispatch/countdown-format"

const MINUTE = 60_000
const HOUR = 3_600_000

describe("formatRemaining", () => {
  it("shows coarse hours from 10h upwards (mockup «⏱ 18h»)", () => {
    expect(formatRemaining(18 * HOUR)).toBe("18h")
    expect(formatRemaining(10 * HOUR)).toBe("10h")
    expect(formatRemaining(47 * HOUR + 59 * MINUTE)).toBe("47h")
  })

  it("shows hours + minutes between 1h and 10h", () => {
    expect(formatRemaining(3 * HOUR + 20 * MINUTE)).toBe("3h 20m")
    expect(formatRemaining(9 * HOUR + 59 * MINUTE)).toBe("9h 59m")
    expect(formatRemaining(HOUR)).toBe("1h")
  })

  it("shows minutes below one hour", () => {
    expect(formatRemaining(45 * MINUTE)).toBe("45m")
    expect(formatRemaining(MINUTE)).toBe("1m")
  })

  it("floors sub-minute remainders to <1m instead of 0m", () => {
    expect(formatRemaining(59_000)).toBe("<1m")
    expect(formatRemaining(1)).toBe("<1m")
  })

  it("never emits negative values for the caller-handled expired case", () => {
    // Callers switch to «Überfällig» at <= 0 — but stay safe on race conditions.
    expect(formatRemaining(0)).toBe("<1m")
  })
})

describe("deadlineStageLabel", () => {
  it("labels both escalation targets in German", () => {
    expect(deadlineStageLabel("reminder_1")).toBe("Erinnerung")
    expect(deadlineStageLabel("timed_out")).toBe("Dispo-Alarm")
  })
})
