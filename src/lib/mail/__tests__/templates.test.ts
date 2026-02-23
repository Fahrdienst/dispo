import { describe, it, expect } from "vitest"
import { driverAssignmentEmail } from "../templates/driver-assignment"

const testData = {
  driverName: "Max Mustermann",
  patientName: "Erika Musterfrau",
  destinationName: "Universitaetsspital Zuerich",
  date: "Do, 27. Feb 2026",
  pickupTime: "14:30",
  direction: "outbound",
  confirmUrl: "https://example.com/api/rides/respond?token=abc123&action=confirm",
  rejectUrl: "https://example.com/api/rides/respond?token=abc123&action=reject",
}

describe("driverAssignmentEmail", () => {
  it("returns subject and html", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.subject).toBeDefined()
    expect(result.html).toBeDefined()
  })

  it("includes date in subject", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.subject).toContain("Do, 27. Feb 2026")
  })

  it("does not include patient name in subject (privacy)", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.subject).not.toContain("Erika Musterfrau")
  })

  it("includes driver name in html", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.html).toContain("Max Mustermann")
  })

  it("includes patient name in html", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.html).toContain("Erika Musterfrau")
  })

  it("includes destination name in html", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.html).toContain("Universitaetsspital Zuerich")
  })

  it("includes pickup time in html", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.html).toContain("14:30")
  })

  it("translates direction to German label", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.html).toContain("Hinfahrt")
  })

  it("includes confirm URL in html", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.html).toContain(testData.confirmUrl)
  })

  it("includes reject URL in html", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.html).toContain(testData.rejectUrl)
  })

  it("includes 48-hour expiry notice", () => {
    const result = driverAssignmentEmail(testData)
    expect(result.html).toContain("48 Stunden")
  })

  it("renders return direction correctly", () => {
    const result = driverAssignmentEmail({ ...testData, direction: "return" })
    // RIDE_DIRECTION_LABELS uses proper umlaut: "Rückfahrt"
    expect(result.html).toContain("R\u00fcckfahrt")
  })

  it("renders both direction correctly", () => {
    const result = driverAssignmentEmail({ ...testData, direction: "both" })
    // RIDE_DIRECTION_LABELS: "Hin & Rück" — ampersand is escaped in HTML
    expect(result.html).toContain("Hin &amp; R\u00fcck")
  })

  it("escapes HTML special characters in user data", () => {
    const result = driverAssignmentEmail({
      ...testData,
      patientName: '<script>alert("xss")</script>',
    })
    expect(result.html).not.toContain("<script>")
    expect(result.html).toContain("&lt;script&gt;")
  })
})
