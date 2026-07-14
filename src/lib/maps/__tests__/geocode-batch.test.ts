import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGeocode } = vi.hoisted(() => ({ mockGeocode: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("../geocode", () => ({ geocodeAddress: mockGeocode }))

import { processGeocodingBatch } from "../geocode-batch"

interface Row {
  id: string
  street: string
  house_number: string
  postal_code: string
  city: string
}

function row(id: string): Row {
  return { id, street: "Teststr", house_number: id, postal_code: "8600", city: "Duebendorf" }
}

/**
 * Minimal fake of the Supabase query builder covering exactly the shapes
 * processGeocodingBatch uses: select-with-filters (data), count head queries,
 * and update().eq(). Records updates + `.or()` filter args for assertions.
 */
function createFake(config: {
  patients: Row[]
  destinations: Row[]
  remaining: { patients: number; destinations: number }
}) {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = []
  const orFilters: string[] = []

  function builder(table: string) {
    const b: Record<string, unknown> = {}
    let isCount = false
    let updatePayload: Record<string, unknown> | null = null

    Object.assign(b, {
      select: (_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) isCount = true
        return b
      },
      or: (expr: string) => {
        orFilters.push(expr)
        return b
      },
      not: () => b,
      order: () => b,
      limit: () => b,
      eq: () => b,
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload
        return b
      },
      then: (resolve: (v: unknown) => unknown) => {
        if (updatePayload) {
          updates.push({ table, payload: updatePayload })
          return resolve({ error: null })
        }
        if (isCount) {
          return resolve({ count: (config.remaining as Record<string, number>)[table] ?? 0 })
        }
        const rows = table === "patients" ? config.patients : config.destinations
        return resolve({ data: rows, error: null })
      },
    })
    return b
  }

  return { client: { from: (t: string) => builder(t) } as never, updates, orFilters }
}

const okResult = {
  lat: 47.4,
  lng: 8.6,
  place_id: "pid",
  formatted_address: "Teststr 1, 8600 Duebendorf",
}

describe("processGeocodingBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("geocodes patients and destinations and marks them success", async () => {
    mockGeocode.mockResolvedValue(okResult)
    const fake = createFake({
      patients: [row("1"), row("2")],
      destinations: [row("3")],
      remaining: { patients: 0, destinations: 0 },
    })

    const res = await processGeocodingBatch(fake.client, 50)

    expect(res.processed).toBe(3)
    expect(res.succeeded).toBe(3)
    expect(res.failed).toBe(0)
    expect(res.remaining).toBe(0)
    expect(res.cursor).toBeTypeOf("string")
    // Every record got a success update
    expect(fake.updates).toHaveLength(3)
    expect(fake.updates.every((u) => u.payload.geocode_status === "success")).toBe(true)
  })

  it("marks ZERO_RESULTS as failed and collects the error", async () => {
    mockGeocode.mockResolvedValue(null) // ZERO_RESULTS
    const fake = createFake({
      patients: [row("1")],
      destinations: [],
      remaining: { patients: 1, destinations: 0 },
    })

    const res = await processGeocodingBatch(fake.client, 50)

    expect(res.succeeded).toBe(0)
    expect(res.failed).toBe(1)
    expect(res.errors[0]?.error).toContain("ZERO_RESULTS")
    expect(fake.updates[0]?.payload.geocode_status).toBe("failed")
  })

  it("marks a thrown geocode error as failed", async () => {
    mockGeocode.mockRejectedValue(new Error("REQUEST_DENIED"))
    const fake = createFake({
      patients: [row("1")],
      destinations: [],
      remaining: { patients: 0, destinations: 0 },
    })

    const res = await processGeocodingBatch(fake.client, 50)

    expect(res.failed).toBe(1)
    expect(res.errors[0]?.error).toContain("REQUEST_DENIED")
    expect(fake.updates[0]?.payload.geocode_status).toBe("failed")
  })

  it("reports remaining from the count queries and reuses a provided cursor", async () => {
    mockGeocode.mockResolvedValue(okResult)
    const fake = createFake({
      patients: [row("1")],
      destinations: [],
      remaining: { patients: 40, destinations: 60 },
    })

    const res = await processGeocodingBatch(fake.client, 50, "2026-07-14T10:00:00.000Z")

    expect(res.remaining).toBe(100)
    expect(res.cursor).toBe("2026-07-14T10:00:00.000Z")
    // The cursor is applied as a geocode_updated_at filter on fetch + count.
    expect(
      fake.orFilters.some((f) => f.includes("geocode_updated_at.lt.2026-07-14T10:00:00.000Z"))
    ).toBe(true)
    // Only pending/failed/null are targeted (success/manual excluded).
    expect(fake.orFilters.some((f) => f.includes("geocode_status.eq.pending"))).toBe(true)
  })

  it("processes records without a house number (label omits it)", async () => {
    mockGeocode.mockResolvedValue(null) // ZERO_RESULTS -> error carries the label
    const noHnr: Row = {
      id: "9",
      street: "Alterszentrum Imwil",
      house_number: null as unknown as string,
      postal_code: "8600",
      city: "Duebendorf",
    }
    const fake = createFake({
      patients: [noHnr],
      destinations: [],
      remaining: { patients: 0, destinations: 0 },
    })

    const res = await processGeocodingBatch(fake.client, 50)

    expect(res.processed).toBe(1)
    expect(res.errors[0]?.address).toBe("Alterszentrum Imwil, 8600 Duebendorf")
  })

  it("does not fetch destinations when patients already fill the limit", async () => {
    mockGeocode.mockResolvedValue(okResult)
    const fake = createFake({
      patients: [row("1"), row("2")],
      destinations: [row("99")],
      remaining: { patients: 5, destinations: 5 },
    })

    // limit 2 is filled by the 2 patients -> destinations fetch is skipped
    const res = await processGeocodingBatch(fake.client, 2)

    expect(res.processed).toBe(2)
    expect(fake.updates.every((u) => u.table === "patients")).toBe(true)
  })
})
