import { describe, it, expect } from "vitest"
import { escapeHtml, formatDate, formatCHF, formatTime } from "../utils"

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B")
  })

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
    )
  })

  it("escapes double quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;")
  })

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s")
  })

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("")
  })

  it("returns safe string unchanged", () => {
    expect(escapeHtml("Max Mustermann")).toBe("Max Mustermann")
  })

  it("handles multiple special characters in one string", () => {
    expect(escapeHtml('a & b < c > d "e" \'f\'')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot; &#x27;f&#x27;"
    )
  })
})

describe("formatDate", () => {
  it("formats a Wednesday date correctly", () => {
    expect(formatDate("2026-02-25")).toBe("Mittwoch, 25. Februar 2026")
  })

  it("formats a Monday date correctly", () => {
    expect(formatDate("2026-02-23")).toBe("Montag, 23. Februar 2026")
  })

  it("formats a Sunday date correctly", () => {
    expect(formatDate("2026-03-01")).toBe("Sonntag, 1. M\u00e4rz 2026")
  })

  it("formats a date in December correctly", () => {
    expect(formatDate("2026-12-24")).toBe("Donnerstag, 24. Dezember 2026")
  })

  it("formats January 1st correctly", () => {
    expect(formatDate("2026-01-01")).toBe("Donnerstag, 1. Januar 2026")
  })
})

describe("formatCHF", () => {
  it("formats whole number", () => {
    expect(formatCHF(65)).toBe("Fr. 65.00")
  })

  it("formats decimal with one digit", () => {
    expect(formatCHF(12.5)).toBe("Fr. 12.50")
  })

  it("formats decimal with two digits", () => {
    expect(formatCHF(99.95)).toBe("Fr. 99.95")
  })

  it("formats zero", () => {
    expect(formatCHF(0)).toBe("Fr. 0.00")
  })

  it("formats large number", () => {
    expect(formatCHF(1234.56)).toBe("Fr. 1234.56")
  })
})

describe("formatTime", () => {
  it("strips seconds from HH:MM:SS", () => {
    expect(formatTime("14:30:00")).toBe("14:30")
  })

  it("keeps HH:MM unchanged", () => {
    expect(formatTime("08:15")).toBe("08:15")
  })

  it("handles midnight", () => {
    expect(formatTime("00:00:00")).toBe("00:00")
  })

  it("handles single-digit seconds", () => {
    expect(formatTime("09:05:07")).toBe("09:05")
  })
})
