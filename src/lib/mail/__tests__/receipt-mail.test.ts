import { describe, it, expect } from "vitest"
import { renderReceiptMail, type ReceiptMailData } from "../receipt-mail"

const base: ReceiptMailData = {
  recipientName: "Maria Muster",
  receiptNumber: "Q-2026-00042",
  periodFrom: "2026-06-01",
  periodTo: "2026-06-30",
  orgName: "Fahrdienst Dübendorf",
}

describe("renderReceiptMail (SEC-M14-004 data minimisation)", () => {
  it("returns subject and html", () => {
    const result = renderReceiptMail(base)
    expect(result.subject).toBeDefined()
    expect(result.html).toBeDefined()
  })

  it("puts the receipt number in the subject without health context", () => {
    const result = renderReceiptMail(base)
    expect(result.subject).toContain("Q-2026-00042")
    // Subject must stay neutral — no destination / route / diagnosis.
    expect(result.subject).not.toMatch(/USZ|Spital|Klinik|Fahrt|→/i)
  })

  it("includes the recipient name, number, period and sender org", () => {
    const result = renderReceiptMail(base)
    expect(result.html).toContain("Maria Muster")
    expect(result.html).toContain("Q-2026-00042")
    expect(result.html).toContain("01.06.2026")
    expect(result.html).toContain("30.06.2026")
    expect(result.html).toContain("Fahrdienst Dübendorf")
  })

  it("collapses a single-day period to one date", () => {
    const result = renderReceiptMail({
      ...base,
      periodFrom: "2026-06-15",
      periodTo: "2026-06-15",
    })
    expect(result.html).toContain("15.06.2026")
    expect(result.html).not.toContain("15.06.2026 –")
  })

  it("carries NO ride details, destinations or health-inferring terms in the body", () => {
    const result = renderReceiptMail(base)
    const html = result.html.toLowerCase()
    // The body must never leak the very things that live only in the PDF.
    expect(html).not.toContain("usz")
    expect(html).not.toContain("spital")
    expect(html).not.toContain("klinik")
    expect(html).not.toMatch(/→|hinfahrt|rückfahrt|\bkm\b/)
    // It explicitly refers to the attachment, never a link.
    expect(html).toContain("anhang")
    expect(html).not.toContain("http")
  })

  it("escapes HTML special characters in user data (XSS)", () => {
    const result = renderReceiptMail({
      ...base,
      recipientName: '<script>alert("xss")</script>',
    })
    expect(result.html).not.toContain("<script>")
    expect(result.html).toContain("&lt;script&gt;")
  })
})
