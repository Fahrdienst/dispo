import { describe, it, expect } from "vitest"
import { buildRideIcs, escapeIcsText, type RideIcsInput } from "../ics"

// ---------------------------------------------------------------------------
// Fixture + helpers
// ---------------------------------------------------------------------------

function createInput(overrides?: Partial<RideIcsInput>): RideIcsInput {
  return {
    rideId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    date: "2026-07-16",
    pickupTime: "08:30:00",
    appointmentTime: "09:15:00",
    direction: "outbound",
    patientFirstName: "Erika",
    patientLastName: "Musterfrau",
    patientPhone: "+41 44 123 45 67",
    patientStreet: "Bahnhofstrasse",
    patientHouseNumber: "42",
    patientPostalCode: "8600",
    patientCity: "Dübendorf",
    destinationName: "Universitätsspital Zürich",
    destinationStreet: "Rämistrasse",
    destinationHouseNumber: "100",
    destinationPostalCode: "8091",
    destinationCity: "Zürich",
    patientImpairments: ["rollator", "companion"],
    notes: "Patient braucht Hilfe beim Einsteigen",
    organizationName: "Patienten-Fahrdienst Dübendorf",
    ...overrides,
  }
}

const FIXED_NOW = new Date("2026-07-10T12:00:00Z")

/**
 * Unfold RFC 5545 folded lines (CRLF followed by a single space/tab) and parse
 * into a map of PROPERTY -> raw value (parameters stripped).
 */
function parseIcs(ics: string): {
  lines: string[]
  props: Record<string, string>
} {
  const unfolded = ics.replace(/\r\n[ \t]/g, "")
  const lines = unfolded.split("\r\n").filter((l) => l.length > 0)
  const props: Record<string, string> = {}
  for (const line of lines) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const namePart = line.slice(0, idx)
    const name = namePart.split(";")[0] ?? namePart
    props[name] = line.slice(idx + 1)
  }
  return { lines, props }
}

// ---------------------------------------------------------------------------
// escapeIcsText
// ---------------------------------------------------------------------------

describe("escapeIcsText", () => {
  it("escapes backslashes", () => {
    expect(escapeIcsText("a\\b")).toBe("a\\\\b")
  })

  it("escapes commas", () => {
    expect(escapeIcsText("a, b")).toBe("a\\, b")
  })

  it("escapes semicolons", () => {
    expect(escapeIcsText("a; b")).toBe("a\\; b")
  })

  it("converts newlines to literal \\n", () => {
    expect(escapeIcsText("line1\nline2")).toBe("line1\\nline2")
  })

  it("converts CRLF to a single literal \\n", () => {
    expect(escapeIcsText("line1\r\nline2")).toBe("line1\\nline2")
  })

  it("leaves umlauts untouched", () => {
    expect(escapeIcsText("Zürich Dübendorf")).toBe("Zürich Dübendorf")
  })

  it("escapes backslash before other specials (order-safe)", () => {
    expect(escapeIcsText("a\\,b")).toBe("a\\\\\\,b")
  })
})

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("buildRideIcs structure", () => {
  it("wraps content in VCALENDAR/VEVENT", () => {
    const ics = buildRideIcs(createInput(), FIXED_NOW)
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true)
    expect(ics).toContain("BEGIN:VEVENT")
    expect(ics).toContain("END:VEVENT")
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true)
  })

  it("uses CRLF line endings", () => {
    const ics = buildRideIcs(createInput(), FIXED_NOW)
    // Every line break must be CRLF; no bare LF outside of CRLF.
    expect(ics).toContain("\r\n")
    expect(/[^\r]\n/.test(ics)).toBe(false)
  })

  it("declares VERSION 2.0 and METHOD PUBLISH", () => {
    const { props } = parseIcs(buildRideIcs(createInput(), FIXED_NOW))
    expect(props.VERSION).toBe("2.0")
    expect(props.METHOD).toBe("PUBLISH")
  })

  it("derives a stable UID from the ride id", () => {
    const { props } = parseIcs(buildRideIcs(createInput(), FIXED_NOW))
    expect(props.UID).toBe(
      "ride-a1b2c3d4-e5f6-7890-abcd-ef1234567890@fahrdienst"
    )
  })

  it("produces the same UID for the same ride (idempotent updates)", () => {
    const a = parseIcs(buildRideIcs(createInput({ pickupTime: "08:30" }), FIXED_NOW))
    const b = parseIcs(buildRideIcs(createInput({ pickupTime: "10:00" }), FIXED_NOW))
    expect(a.props.UID).toBe(b.props.UID)
  })

  it("marks the event CONFIRMED", () => {
    const { props } = parseIcs(buildRideIcs(createInput(), FIXED_NOW))
    expect(props.STATUS).toBe("CONFIRMED")
  })

  it("sets DTSTAMP from the injected clock", () => {
    const { props } = parseIcs(buildRideIcs(createInput(), FIXED_NOW))
    expect(props.DTSTAMP).toBe("20260710T120000Z")
  })
})

// ---------------------------------------------------------------------------
// Timezone (Europe/Zurich -> UTC)
// ---------------------------------------------------------------------------

describe("buildRideIcs timezone conversion", () => {
  it("converts summer (CEST, UTC+2) wall time to UTC", () => {
    // 2026-07-16 08:30 Europe/Zurich = 06:30 UTC
    const { props } = parseIcs(
      buildRideIcs(createInput({ date: "2026-07-16", pickupTime: "08:30:00" }), FIXED_NOW)
    )
    expect(props.DTSTART).toBe("20260716T063000Z")
  })

  it("converts winter (CET, UTC+1) wall time to UTC", () => {
    // 2026-01-15 08:30 Europe/Zurich = 07:30 UTC
    const { props } = parseIcs(
      buildRideIcs(createInput({ date: "2026-01-15", pickupTime: "08:30:00" }), FIXED_NOW)
    )
    expect(props.DTSTART).toBe("20260115T073000Z")
  })

  it("derives DTEND from the appointment time", () => {
    // pickup 08:30, appointment 09:15 -> 45 min duration, summer offset
    const { props } = parseIcs(
      buildRideIcs(
        createInput({
          date: "2026-07-16",
          pickupTime: "08:30:00",
          appointmentTime: "09:15:00",
        }),
        FIXED_NOW
      )
    )
    expect(props.DTSTART).toBe("20260716T063000Z")
    expect(props.DTEND).toBe("20260716T071500Z")
  })

  it("falls back to a 60-minute default DTEND without an appointment", () => {
    const { props } = parseIcs(
      buildRideIcs(
        createInput({
          date: "2026-07-16",
          pickupTime: "08:30:00",
          appointmentTime: null,
        }),
        FIXED_NOW
      )
    )
    expect(props.DTSTART).toBe("20260716T063000Z")
    expect(props.DTEND).toBe("20260716T073000Z")
  })

  it("falls back to default when appointment is not after pickup", () => {
    const { props } = parseIcs(
      buildRideIcs(
        createInput({
          date: "2026-07-16",
          pickupTime: "09:00:00",
          appointmentTime: "08:30:00",
        }),
        FIXED_NOW
      )
    )
    // 09:00 CEST -> 07:00 UTC, +60 min -> 08:00 UTC
    expect(props.DTEND).toBe("20260716T080000Z")
  })

  it("accepts HH:MM pickup times without seconds", () => {
    const { props } = parseIcs(
      buildRideIcs(createInput({ date: "2026-07-16", pickupTime: "08:30" }), FIXED_NOW)
    )
    expect(props.DTSTART).toBe("20260716T063000Z")
  })
})

// ---------------------------------------------------------------------------
// Content: SUMMARY / LOCATION / DESCRIPTION
// ---------------------------------------------------------------------------

describe("buildRideIcs content", () => {
  it("builds a route-based SUMMARY (Von -> Nach) for outbound rides", () => {
    const { props } = parseIcs(buildRideIcs(createInput(), FIXED_NOW))
    expect(props.SUMMARY).toBe("Fahrt: Dübendorf → Universitätsspital Zürich")
  })

  it("swaps origin/destination in the SUMMARY for return rides", () => {
    const { props } = parseIcs(
      buildRideIcs(createInput({ direction: "return" }), FIXED_NOW)
    )
    expect(props.SUMMARY).toBe("Fahrt: Universitätsspital Zürich → Dübendorf")
  })

  it("uses the patient address as LOCATION for outbound rides", () => {
    const { props } = parseIcs(buildRideIcs(createInput(), FIXED_NOW))
    expect(props.LOCATION).toBe("Bahnhofstrasse 42\\, 8600 Dübendorf")
  })

  it("uses the destination address as LOCATION for return rides", () => {
    const { props } = parseIcs(
      buildRideIcs(createInput({ direction: "return" }), FIXED_NOW)
    )
    expect(props.LOCATION).toBe("Rämistrasse 100\\, 8091 Zürich")
  })

  it("includes patient name, phone and mobility aids in DESCRIPTION", () => {
    const { props } = parseIcs(buildRideIcs(createInput(), FIXED_NOW))
    expect(props.DESCRIPTION).toContain("Fahrgast: Erika Musterfrau")
    expect(props.DESCRIPTION).toContain("Telefon: +41 44 123 45 67")
    expect(props.DESCRIPTION).toContain("Hilfsmittel: Rollator\\, Begleitperson")
  })

  it("escapes commas and newlines in the DESCRIPTION", () => {
    const { props } = parseIcs(
      buildRideIcs(createInput({ notes: "Klingeln, dann warten" }), FIXED_NOW)
    )
    // literal escaped comma + literal escaped newline between fields
    expect(props.DESCRIPTION).toContain("Hinweise: Klingeln\\, dann warten")
    expect(props.DESCRIPTION).toContain("\\n")
  })

  it("omits optional DESCRIPTION fields when absent", () => {
    const { props } = parseIcs(
      buildRideIcs(
        createInput({ patientPhone: null, notes: null, patientImpairments: [] }),
        FIXED_NOW
      )
    )
    expect(props.DESCRIPTION).not.toContain("Telefon:")
    expect(props.DESCRIPTION).not.toContain("Hinweise:")
    expect(props.DESCRIPTION).not.toContain("Hilfsmittel:")
  })

  it("preserves umlauts in the raw output (UTF-8, not escaped)", () => {
    const ics = buildRideIcs(createInput(), FIXED_NOW)
    expect(ics).toContain("Dübendorf")
    expect(ics).toContain("Zürich")
  })
})

// ---------------------------------------------------------------------------
// Line folding
// ---------------------------------------------------------------------------

describe("buildRideIcs line folding", () => {
  it("folds lines longer than 75 octets", () => {
    const longNotes =
      "Dies ist eine sehr lange Bemerkung die deutlich mehr als fünfundsiebzig " +
      "Oktette umfasst und daher gefaltet werden muss damit die Datei RFC 5545 konform bleibt"
    const ics = buildRideIcs(createInput({ notes: longNotes }), FIXED_NOW)

    const encoder = new TextEncoder()
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it("never splits a multi-byte character across a fold", () => {
    const umlautHeavy = "ü".repeat(60) // 120 octets -> must fold
    const ics = buildRideIcs(createInput({ notes: umlautHeavy }), FIXED_NOW)
    // Unfolding must restore the exact run of umlauts.
    const unfolded = ics.replace(/\r\n[ \t]/g, "")
    expect(unfolded).toContain("ü".repeat(60))
  })
})
