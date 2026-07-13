import { describe, it, expect } from "vitest"
import {
  resolveHelpContext,
  FALLBACK_HELP_CONTEXT,
  type HelpContext,
} from "../context-map"

// ---------------------------------------------------------------------------
// Per-row mapping (each specific route resolves to its declared slug)
// ---------------------------------------------------------------------------

describe("resolveHelpContext — specific routes", () => {
  const cases: { pathname: string; expectedSlug: string }[] = [
    { pathname: "/dispatch", expectedSlug: "dispatch-board" },
    { pathname: "/rides/new", expectedSlug: "fahrt-erfassen" },
    { pathname: "/rides/abc-123", expectedSlug: "fahrt-details" },
    { pathname: "/patients", expectedSlug: "patient-anlegen" },
    {
      pathname: "/drivers/42/availability",
      expectedSlug: "verfuegbarkeit",
    },
    { pathname: "/settings/fares", expectedSlug: "abrechnung" },
    { pathname: "/my/rides", expectedSlug: "fahrer-fahrten" },
  ]

  it.each(cases)(
    "maps $pathname -> $expectedSlug",
    ({ pathname, expectedSlug }) => {
      expect(resolveHelpContext(pathname).helpSlug).toBe(expectedSlug)
    }
  )

  it("returns a non-empty label for every specific route", () => {
    for (const { pathname } of cases) {
      const ctx = resolveHelpContext(pathname)
      expect(ctx.label.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Priority ordering (specific BEFORE generic — first match wins)
// ---------------------------------------------------------------------------

describe("resolveHelpContext — priority ordering", () => {
  it("prefers /rides/new over the generic /rides/[id] rule", () => {
    expect(resolveHelpContext("/rides/new").helpSlug).toBe("fahrt-erfassen")
  })

  it("treats any other /rides/* segment as ride details", () => {
    expect(resolveHelpContext("/rides/00000000-0000-0000-0000-000000000000").helpSlug).toBe(
      "fahrt-details"
    )
  })

  it("matches driver availability only on the availability sub-route", () => {
    expect(resolveHelpContext("/drivers/7/availability").helpSlug).toBe("verfuegbarkeit")
    // A driver route WITHOUT /availability must NOT resolve to verfuegbarkeit.
    expect(resolveHelpContext("/drivers/7").helpSlug).not.toBe("verfuegbarkeit")
  })
})

// ---------------------------------------------------------------------------
// Sub-paths and trailing slashes
// ---------------------------------------------------------------------------

describe("resolveHelpContext — path variations", () => {
  it("matches trailing slashes", () => {
    expect(resolveHelpContext("/dispatch/").helpSlug).toBe("dispatch-board")
  })

  it("matches nested sub-paths under a mapped prefix", () => {
    expect(resolveHelpContext("/patients/123/edit").helpSlug).toBe("patient-anlegen")
  })

  it("strips query strings and hashes before matching", () => {
    expect(resolveHelpContext("/rides/new?copyFrom=9").helpSlug).toBe("fahrt-erfassen")
    expect(resolveHelpContext("/dispatch#top").helpSlug).toBe("dispatch-board")
  })
})

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

describe("resolveHelpContext — fallback", () => {
  const unmatched: string[] = ["/", "/dashboard", "/settings", "/drivers", "/unknown/path"]

  it.each(unmatched)("falls back to app-uebersicht for %s", (pathname) => {
    const ctx = resolveHelpContext(pathname)
    expect(ctx.helpSlug).toBe("app-uebersicht")
    expect(ctx.label).toBe("Hilfe zu dieser Seite")
  })

  it("exposes the fallback as a stable constant", () => {
    const expected: HelpContext = {
      helpSlug: "app-uebersicht",
      label: "Hilfe zu dieser Seite",
    }
    expect(FALLBACK_HELP_CONTEXT).toEqual(expected)
  })
})
