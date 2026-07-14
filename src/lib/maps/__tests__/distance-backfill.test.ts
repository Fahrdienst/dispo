import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetRoute } = vi.hoisted(() => ({ mockGetRoute: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("../directions", () => ({ getRoute: mockGetRoute }))

import { processDistanceBackfill } from "../distance-backfill"

const ZERO_UUID = "00000000-0000-0000-0000-000000000000"

interface EligibleRide {
  id: string
  patients: { lat: number | null; lng: number | null } | null
  destinations: { lat: number | null; lng: number | null } | null
}

function ride(id: string): EligibleRide {
  return {
    id,
    patients: { lat: 47.4, lng: 8.6 },
    destinations: { lat: 47.37, lng: 8.54 },
  }
}

/**
 * Minimal fake of the Supabase query builder covering the exact shapes
 * processDistanceBackfill uses:
 *   - eligible fetch: select(...).eq().is().not()x4.gt().order().limit() -> data
 *   - three head counts (openTotal, remainingAtCursor, remainingGeocodable),
 *     disambiguated by whether `.not()` (geocoded filter) and `.gt(cursor)` ran
 *   - update(payload).eq() on success
 * Records updates and the `.gt()` cursor args for assertions.
 */
function createFake(config: {
  eligible: EligibleRide[]
  counts: { openTotal: number; remainingAtCursor: number; remainingGeocodable: number }
}) {
  const updates: Array<{ payload: Record<string, unknown>; id: string }> = []
  const gtArgs: string[] = []

  function builder() {
    const b: Record<string, unknown> = {}
    let isHead = false
    let hasNot = false
    let gtArg: string | null = null
    let updatePayload: Record<string, unknown> | null = null
    let updateId: string | null = null

    Object.assign(b, {
      select: (_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) isHead = true
        return b
      },
      eq: (col: string, val: string) => {
        if (updatePayload) updateId = val
        void col
        return b
      },
      is: () => b,
      not: () => {
        hasNot = true
        return b
      },
      gt: (_col: string, val: string) => {
        gtArg = val
        gtArgs.push(val)
        return b
      },
      order: () => b,
      limit: () => b,
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload
        return b
      },
      then: (resolve: (v: unknown) => unknown) => {
        if (updatePayload) {
          updates.push({ payload: updatePayload, id: updateId ?? "" })
          return resolve({ error: null })
        }
        if (isHead) {
          if (!hasNot) return resolve({ count: config.counts.openTotal })
          if (gtArg === ZERO_UUID)
            return resolve({ count: config.counts.remainingGeocodable })
          return resolve({ count: config.counts.remainingAtCursor })
        }
        return resolve({ data: config.eligible, error: null })
      },
    })
    return b
  }

  return { client: { from: () => builder() } as never, updates, gtArgs }
}

const okRoute = { distance_meters: 12500, duration_seconds: 900, polyline: "abc" }

describe("processDistanceBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("backfills eligible rides and stamps distance_source=backfill", async () => {
    mockGetRoute.mockResolvedValue(okRoute)
    const fake = createFake({
      eligible: [ride("11111111-0000-0000-0000-000000000001"), ride("11111111-0000-0000-0000-000000000002")],
      counts: { openTotal: 2, remainingAtCursor: 0, remainingGeocodable: 2 },
    })

    const res = await processDistanceBackfill(fake.client, 25)

    expect(res.processed).toBe(2)
    expect(res.succeeded).toBe(2)
    expect(res.failed).toBe(0)
    expect(res.remaining).toBe(0)
    expect(fake.updates).toHaveLength(2)
    expect(fake.updates.every((u) => u.payload.distance_source === "backfill")).toBe(true)
    expect(fake.updates.every((u) => u.payload.distance_meters === 12500)).toBe(true)
    // Cursor advances to the greatest processed id.
    expect(res.cursor).toBe("11111111-0000-0000-0000-000000000002")
  })

  it("never overwrites: a manually corrected ride is out of the null-distance set", async () => {
    // The eligible fetch only ever returns distance_meters IS NULL rows; a filled
    // ride simply never appears. With no eligible rows nothing is updated and the
    // run is complete.
    mockGetRoute.mockResolvedValue(okRoute)
    const fake = createFake({
      eligible: [],
      counts: { openTotal: 0, remainingAtCursor: 0, remainingGeocodable: 0 },
    })

    const res = await processDistanceBackfill(fake.client, 25, "cursor-x")

    expect(res.processed).toBe(0)
    expect(res.remaining).toBe(0)
    expect(fake.updates).toHaveLength(0)
    // Cursor is preserved when nothing was fetched (loop terminates on processed 0).
    expect(res.cursor).toBe("cursor-x")
    expect(mockGetRoute).not.toHaveBeenCalled()
  })

  it("reports a failed route and keeps the loop terminating (cursor still advances)", async () => {
    mockGetRoute.mockRejectedValue(new Error("ZERO_RESULTS"))
    const failing = ride("22222222-0000-0000-0000-000000000009")
    const fake = createFake({
      eligible: [failing],
      // The failed ride keeps distance NULL, so it stays in the geocodable set,
      // but it is now behind the cursor → remainingAtCursor excludes it.
      counts: { openTotal: 1, remainingAtCursor: 0, remainingGeocodable: 1 },
    })

    const res = await processDistanceBackfill(fake.client, 25)

    expect(res.processed).toBe(1)
    expect(res.succeeded).toBe(0)
    expect(res.failed).toBe(1)
    expect(res.errors[0]?.rideId).toBe(failing.id)
    expect(res.errors[0]?.error).toContain("ZERO_RESULTS")
    expect(fake.updates).toHaveLength(0)
    expect(res.remaining).toBe(0) // terminates: the failed ride is behind the cursor
    expect(res.cursor).toBe(failing.id)
  })

  it("derives skipped (not-geocodable) from openTotal minus geocodable", async () => {
    mockGetRoute.mockResolvedValue(okRoute)
    const fake = createFake({
      eligible: [ride("33333333-0000-0000-0000-000000000001")],
      counts: { openTotal: 5, remainingAtCursor: 1, remainingGeocodable: 2 },
    })

    const res = await processDistanceBackfill(fake.client, 25)

    // 5 completed-without-distance total, 2 still geocodable → 3 need manual geo.
    expect(res.skipped).toBe(3)
  })

  it("uses the provided cursor as the keyset lower bound (idempotent re-run)", async () => {
    mockGetRoute.mockResolvedValue(okRoute)
    const fake = createFake({
      eligible: [ride("44444444-0000-0000-0000-000000000001")],
      counts: { openTotal: 1, remainingAtCursor: 0, remainingGeocodable: 1 },
    })

    await processDistanceBackfill(fake.client, 25, "44444444-0000-0000-0000-000000000000")

    // The eligible fetch must filter id > providedCursor (not the ZERO default).
    expect(fake.gtArgs).toContain("44444444-0000-0000-0000-000000000000")
  })

  it("defaults the keyset cursor to the zero-uuid on the first call", async () => {
    mockGetRoute.mockResolvedValue(okRoute)
    const fake = createFake({
      eligible: [],
      counts: { openTotal: 0, remainingAtCursor: 0, remainingGeocodable: 0 },
    })

    await processDistanceBackfill(fake.client, 25)

    expect(fake.gtArgs).toContain(ZERO_UUID)
  })
})
