import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * createRide — "never-block" persistence + save_intent behavior (Issue #130/#139, M13).
 *
 * These are server-action-level tests analogous to `rides.test.ts`: the whole
 * Supabase client, auth, price calculation, telemetry, audit and navigation are
 * mocked, so no DB is touched. They pin the two behaviors that make the capture
 * page (#131/#139) work:
 *
 *   1. Missing geocoding / price / appointment time NEVER blocks the save. The
 *      ride is inserted and the action returns `success: true` with structured,
 *      non-blocking `warnings` instead of redirecting away.
 *   2. `save_intent=order_sheet` suppresses the post-save redirect even on a
 *      clean save, so the form can open the M11 order sheet; the default
 *      (`list`) redirects to the day view.
 *
 * Honest scope: the return-ride branch, the series delegation and the driver
 * availability guard are NOT exercised here — they are covered by DB-side /
 * manual verification (see ADR-014). The `from()` stub only implements the
 * chains the tested paths hit.
 */

// ---------------------------------------------------------------------------
// Hoisted mock handles
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAuth: vi.fn(),
  calcPrice: vi.fn(),
  isPriceFailure: vi.fn(),
  redirect: vi.fn((url: string) => {
    // Mirror Next.js: redirect() interrupts by throwing.
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
  revalidatePath: vi.fn(),
  trackEvent: vi.fn(),
  logAudit: vi.fn().mockResolvedValue(undefined),
  loadRideTimeBuffers: vi.fn().mockResolvedValue({
    pickupBufferMinutes: 5,
    boardingMinutes: 0,
    returnBufferMinutes: 15,
  }),
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: h.createClient }))
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: h.requireAuth }))
vi.mock("@/lib/billing/calculate-price", () => ({
  calculateRidePrice: h.calcPrice,
  isPriceCalculationFailure: h.isPriceFailure,
}))
vi.mock("next/navigation", () => ({ redirect: h.redirect }))
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }))
vi.mock("@/lib/telemetry", () => ({ trackEvent: h.trackEvent }))
vi.mock("@/lib/audit/logger", () => ({ logAudit: h.logAudit }))
vi.mock("@/lib/rides/time-buffers", () => ({
  loadRideTimeBuffers: h.loadRideTimeBuffers,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { createRide } from "../rides"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type GeoRow = {
  postal_code: string | null
  lat: number | null
  lng: number | null
  geocode_status: string
  display_name?: string
}

interface ClientOpts {
  patient: GeoRow
  destination: GeoRow
  insertedRide: Record<string, unknown>
  insertError?: { message: string } | null
}

/** Build a table-aware Supabase stub covering only the chains createRide hits. */
function makeClient({
  patient,
  destination,
  insertedRide,
  insertError = null,
}: ClientOpts) {
  const rideInsert = vi.fn(() => ({
    select: () => ({
      single: () =>
        Promise.resolve({ data: insertedRide, error: insertError }),
    }),
  }))

  const from = vi.fn((table: string) => {
    if (table === "patients") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: patient, error: null }),
          }),
        }),
      }
    }
    if (table === "destinations") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: destination, error: null }),
          }),
        }),
      }
    }
    if (table === "rides") {
      return { insert: rideInsert }
    }
    // Fallback for any incidental table access.
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
  })

  return { from }
}

const PATIENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const DEST_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

/** Build a FormData for the capture form. */
function buildFormData(
  fields: Record<string, string> = {}
): FormData {
  const fd = new FormData()
  fd.set("patient_id", PATIENT_ID)
  fd.set("destination_id", DEST_ID)
  fd.set("date", "2026-03-15")
  fd.set("pickup_time", "08:30")
  fd.set("direction", "outbound")
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const geocoded: GeoRow = {
  postal_code: "8600",
  lat: 47.39,
  lng: 8.62,
  geocode_status: "success",
  display_name: "Spital Uster",
}

const notGeocoded: GeoRow = {
  postal_code: "8600",
  lat: null,
  lng: null,
  geocode_status: "pending",
  display_name: "Spital Uster",
}

const successfulPrice = {
  distance_meters: 5000,
  duration_seconds: 600,
  calculated_price: 12,
  fare_rule_id: null,
  tariff_zone: "gemeinde",
  surcharge_amount: 0,
  breakdown: [] as unknown[],
  polyline: null,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createRide — never-block (#130)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requireAuth.mockResolvedValue({
      authorized: true,
      userId: "user-1",
      role: "operator",
      driverId: null,
    })
    h.loadRideTimeBuffers.mockResolvedValue({
      pickupBufferMinutes: 5,
      boardingMinutes: 0,
      returnBufferMinutes: 15,
    })
    h.logAudit.mockResolvedValue(undefined)
  })

  it("saves and returns warnings instead of redirecting when nothing is geocoded", async () => {
    h.createClient.mockResolvedValue(
      makeClient({
        patient: notGeocoded,
        destination: notGeocoded,
        insertedRide: { id: "ride-1", date: "2026-03-15" },
      })
    )

    const result = await createRide(null, buildFormData())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({ id: "ride-1" })
      const codes = (result.warnings ?? []).map((w) => w.code)
      expect(codes).toEqual([
        "patient_not_geocoded",
        "destination_not_geocoded",
        "price_not_calculated",
        "appointment_time_missing",
      ])
    }
    // Never navigated away.
    expect(h.redirect).not.toHaveBeenCalled()
  })

  it("never calls the price calculation when coordinates are missing", async () => {
    h.createClient.mockResolvedValue(
      makeClient({
        patient: notGeocoded,
        destination: notGeocoded,
        insertedRide: { id: "ride-2" },
      })
    )

    await createRide(null, buildFormData())

    expect(h.calcPrice).not.toHaveBeenCalled()
  })

  it("returns a field error and does not insert when validation fails", async () => {
    const insertedRide = { id: "should-not-happen" }
    const client = makeClient({
      patient: geocoded,
      destination: geocoded,
      insertedRide,
    })
    h.createClient.mockResolvedValue(client)

    const fd = buildFormData()
    fd.set("patient_id", "not-a-uuid")

    const result = await createRide(null, fd)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.fieldErrors?.patient_id).toBeDefined()
    }
    // No ride table access on the validation-failure path.
    expect(client.from).not.toHaveBeenCalledWith("rides")
  })

  it("still returns the created ride when geocoded but the appointment time is missing", async () => {
    h.calcPrice.mockResolvedValue(successfulPrice)
    h.isPriceFailure.mockReturnValue(false)
    h.createClient.mockResolvedValue(
      makeClient({
        patient: geocoded,
        destination: geocoded,
        insertedRide: { id: "ride-3" },
      })
    )

    const result = await createRide(null, buildFormData())

    expect(result.success).toBe(true)
    if (result.success) {
      const codes = (result.warnings ?? []).map((w) => w.code)
      // Geo + price resolved -> only the appointment-time warning remains.
      expect(codes).toEqual(["appointment_time_missing"])
    }
    expect(h.redirect).not.toHaveBeenCalled()
  })
})

describe("createRide — save_intent (#139)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requireAuth.mockResolvedValue({
      authorized: true,
      userId: "user-1",
      role: "operator",
      driverId: null,
    })
    h.calcPrice.mockResolvedValue(successfulPrice)
    h.isPriceFailure.mockReturnValue(false)
    h.logAudit.mockResolvedValue(undefined)
  })

  it("redirects to the day view on a clean save with save_intent=list", async () => {
    h.createClient.mockResolvedValue(
      makeClient({
        patient: geocoded,
        destination: geocoded,
        insertedRide: { id: "ride-4", date: "2026-03-15" },
      })
    )

    await expect(
      createRide(
        null,
        buildFormData({ appointment_time: "09:00", save_intent: "list" })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/rides?date=2026-03-15")

    expect(h.redirect).toHaveBeenCalledWith("/rides?date=2026-03-15")
  })

  it("skips the redirect on a clean save with save_intent=order_sheet", async () => {
    h.createClient.mockResolvedValue(
      makeClient({
        patient: geocoded,
        destination: geocoded,
        insertedRide: { id: "ride-5", date: "2026-03-15" },
      })
    )

    const result = await createRide(
      null,
      buildFormData({ appointment_time: "09:00", save_intent: "order_sheet" })
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({ id: "ride-5" })
      // Clean save -> no warnings, but redirect is suppressed for the order sheet.
      expect(result.warnings ?? []).toEqual([])
    }
    expect(h.redirect).not.toHaveBeenCalled()
  })
})

describe("createRide — auth guard", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects unauthenticated callers before touching the DB", async () => {
    h.requireAuth.mockResolvedValue({
      authorized: false,
      error: "Nicht authentifiziert",
    })

    const result = await createRide(null, buildFormData())

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Nicht authentifiziert")
    }
    expect(h.createClient).not.toHaveBeenCalled()
  })
})
