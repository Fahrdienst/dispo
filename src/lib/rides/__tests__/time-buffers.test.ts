import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * loadRideTimeBuffers — org-wide buffer loader (Issue #129, M13).
 *
 * The pure math lives in `time-calc.ts` (fully covered in time-calc.test.ts);
 * this loader is the thin I/O layer that reads the singleton
 * `organization_settings` row and — crucially — must NEVER break ride creation:
 * on any error or missing row it falls back to the legacy defaults, and any
 * individual NULL column falls back per-field.
 *
 * A stub Supabase client is injected via the optional `client` parameter, so no
 * real DB or `@/lib/supabase/server` mock is required.
 */

import {
  loadRideTimeBuffers,
  DEFAULT_RIDE_TIME_BUFFERS,
} from "../time-buffers"

type SingleResult = {
  data: Record<string, number | null> | null
  error: { message: string } | null
}

/** Build a stub client whose `.single()` resolves to the given result. */
function makeClient(result: SingleResult) {
  const single = vi.fn().mockResolvedValue(result)
  const limit = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ select })
  // Cast through unknown: the loader only ever calls from().select().limit().single().
  return { client: { from } as unknown as Parameters<typeof loadRideTimeBuffers>[0], from, select }
}

describe("loadRideTimeBuffers (#129)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the configured buffers when the row is present", async () => {
    const { client } = makeClient({
      data: {
        default_pickup_buffer_minutes: 7,
        default_boarding_minutes: 4,
        default_return_buffer_minutes: 25,
      },
      error: null,
    })

    const buffers = await loadRideTimeBuffers(client)

    expect(buffers).toEqual({
      pickupBufferMinutes: 7,
      boardingMinutes: 4,
      returnBufferMinutes: 25,
    })
  })

  it("falls back to defaults on a query error (never blocks)", async () => {
    const { client } = makeClient({
      data: null,
      error: { message: "RLS denied" },
    })

    const buffers = await loadRideTimeBuffers(client)

    expect(buffers).toEqual(DEFAULT_RIDE_TIME_BUFFERS)
  })

  it("falls back to defaults when no row exists", async () => {
    const { client } = makeClient({ data: null, error: null })

    const buffers = await loadRideTimeBuffers(client)

    expect(buffers).toEqual(DEFAULT_RIDE_TIME_BUFFERS)
  })

  it("falls back per-field when individual columns are NULL", async () => {
    const { client } = makeClient({
      data: {
        default_pickup_buffer_minutes: null,
        default_boarding_minutes: 9,
        default_return_buffer_minutes: null,
      },
      error: null,
    })

    const buffers = await loadRideTimeBuffers(client)

    expect(buffers).toEqual({
      pickupBufferMinutes: DEFAULT_RIDE_TIME_BUFFERS.pickupBufferMinutes,
      boardingMinutes: 9,
      returnBufferMinutes: DEFAULT_RIDE_TIME_BUFFERS.returnBufferMinutes,
    })
  })

  it("exposes defaults matching the legacy hardcoded constants", () => {
    expect(DEFAULT_RIDE_TIME_BUFFERS).toEqual({
      pickupBufferMinutes: 5,
      boardingMinutes: 0,
      returnBufferMinutes: 15,
    })
  })

  it("reads exactly the three buffer columns from organization_settings", async () => {
    const { client, from, select } = makeClient({
      data: {
        default_pickup_buffer_minutes: 5,
        default_boarding_minutes: 0,
        default_return_buffer_minutes: 15,
      },
      error: null,
    })

    await loadRideTimeBuffers(client)

    expect(from).toHaveBeenCalledWith("organization_settings")
    expect(select).toHaveBeenCalledWith(
      "default_pickup_buffer_minutes, default_boarding_minutes, default_return_buffer_minutes"
    )
  })
})
