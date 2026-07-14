import { describe, it, expect } from "vitest"
import { absenceDecisionEmail } from "../templates/absence-decision"
import type { AbsenceDecisionEmailData } from "../templates/absence-decision"

const base: AbsenceDecisionEmailData = {
  driverName: "Max Mustermann",
  type: "vacation",
  startDate: "2026-07-20",
  endDate: "2026-07-24",
  decision: "approved",
  note: null,
}

describe("absenceDecisionEmail", () => {
  it("returns subject and html", () => {
    const result = absenceDecisionEmail(base)
    expect(result.subject).toBeDefined()
    expect(result.html).toBeDefined()
  })

  it("uses a positive subject when approved", () => {
    const result = absenceDecisionEmail(base)
    expect(result.subject).toContain("genehmigt")
  })

  it("uses a rejection subject when rejected", () => {
    const result = absenceDecisionEmail({ ...base, decision: "rejected" })
    expect(result.subject).toContain("abgelehnt")
  })

  it("includes the driver name", () => {
    const result = absenceDecisionEmail(base)
    expect(result.html).toContain("Max Mustermann")
  })

  it("includes the German absence type label", () => {
    const result = absenceDecisionEmail(base)
    expect(result.html).toContain("Ferien")
  })

  it("renders the date range in Swiss format", () => {
    const result = absenceDecisionEmail(base)
    expect(result.html).toContain("20.07.2026")
    expect(result.html).toContain("24.07.2026")
  })

  it("collapses a single-day absence to one date", () => {
    const result = absenceDecisionEmail({
      ...base,
      startDate: "2026-07-20",
      endDate: "2026-07-20",
    })
    // Only one occurrence of the date, no en-dash range separator.
    expect(result.html).toContain("20.07.2026")
    expect(result.html).not.toContain("20.07.2026 –")
  })

  it("renders the optional note when present", () => {
    const result = absenceDecisionEmail({
      ...base,
      decision: "rejected",
      note: "Zu kurzfristig",
    })
    expect(result.html).toContain("Zu kurzfristig")
  })

  it("omits the note block when note is null", () => {
    const result = absenceDecisionEmail(base)
    expect(result.html).not.toContain("Anmerkung der Disposition")
  })

  it("escapes HTML special characters in user data", () => {
    const result = absenceDecisionEmail({
      ...base,
      driverName: '<script>alert("xss")</script>',
    })
    expect(result.html).not.toContain("<script>")
    expect(result.html).toContain("&lt;script&gt;")
  })
})
