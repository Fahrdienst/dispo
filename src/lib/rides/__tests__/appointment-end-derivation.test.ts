import { describe, it, expect } from "vitest"
import { addMinutesToTime } from "@/lib/validations/rides"

/**
 * Appointment-end derivation contract (Issue #131/#133, M13).
 *
 * The capture form (`ride-capture-form.tsx`) derives the hidden
 * `appointment_end_time` field purely from the appointment start plus the
 * chosen "Termindauer":
 *
 *     appointment_end_time = addMinutesToTime(appointmentTime, durationMinutes)
 *
 * The ternary and the `DURATION_PRESETS` array live inline in the client
 * component and are therefore not importable in isolation without modifying M13
 * source. This file instead pins the *arithmetic contract* the component relies
 * on — the exported, pure `addMinutesToTime` helper — for every preset the UI
 * offers, so a regression in the helper (rollover, overflow, padding) is caught.
 *
 * NOTE (honest coverage): the `durationMinutes >= 120 -> "over_2h"` bucket
 * threshold itself is an inline component ternary (`OVER_2H_THRESHOLD_MINUTES`)
 * and is NOT exercised here. Its downstream consumer,
 * `calculateDuebendorfTariff`, is covered in
 * `src/lib/billing/__tests__/duebendorf-tariff.test.ts`; the threshold wiring is
 * verified manually / via the tariff preview in the browser (see ADR-014).
 */

// Mirror of the UI presets (documented, not imported — see file header).
const DURATION_PRESETS = [30, 45, 60, 90, 120, 180] as const

describe("appointment_end_time derivation (Terminbeginn + Termindauer)", () => {
  it.each([
    [30, "10:30"],
    [45, "10:45"],
    [60, "11:00"],
    [90, "11:30"],
    [120, "12:00"],
    [180, "13:00"],
  ] as const)(
    "derives end time for a %i-minute appointment starting at 10:00",
    (duration, expected) => {
      expect(addMinutesToTime("10:00", duration)).toBe(expected)
    }
  )

  it("covers every documented preset without producing null in a normal day", () => {
    for (const preset of DURATION_PRESETS) {
      // Morning appointments never overflow the 23:59 boundary.
      expect(addMinutesToTime("09:00", preset)).not.toBeNull()
    }
  })

  it("handles hour rollover in the derived end time", () => {
    expect(addMinutesToTime("09:50", 30)).toBe("10:20")
  })

  it("yields null (empty hidden field) when the appointment overflows midnight", () => {
    // e.g. a 3h appointment starting at 22:30 -> 01:30 next day is invalid.
    expect(addMinutesToTime("22:30", 180)).toBeNull()
  })

  it("returns the start time unchanged for a zero-length duration (no preset)", () => {
    expect(addMinutesToTime("14:15", 0)).toBe("14:15")
  })
})
