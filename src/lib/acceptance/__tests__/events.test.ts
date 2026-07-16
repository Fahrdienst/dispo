import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
    }),
  })),
}))

// Import after mock
import { recordAssignmentEvent } from "../events"

describe("recordAssignmentEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("inserts a fully-specified assignment event", async () => {
    mockInsert.mockResolvedValue({ error: null })

    await recordAssignmentEvent({
      rideId: "ride-1",
      driverId: "driver-1",
      acceptanceTrackingId: "track-1",
      event: "reminder_sent",
      actor: "system",
      detail: "reminder_2",
    })

    expect(mockInsert).toHaveBeenCalledOnce()
    expect(mockInsert).toHaveBeenCalledWith({
      ride_id: "ride-1",
      driver_id: "driver-1",
      acceptance_tracking_id: "track-1",
      event: "reminder_sent",
      actor: "system",
      detail: "reminder_2",
    })
  })

  it("defaults optional fields to null", async () => {
    mockInsert.mockResolvedValue({ error: null })

    await recordAssignmentEvent({
      rideId: "ride-2",
      event: "requested",
      actor: "dispatcher",
    })

    expect(mockInsert).toHaveBeenCalledWith({
      ride_id: "ride-2",
      driver_id: null,
      acceptance_tracking_id: null,
      event: "requested",
      actor: "dispatcher",
      detail: null,
    })
  })

  it("persists the server-derived actor verbatim (no client override)", async () => {
    mockInsert.mockResolvedValue({ error: null })

    await recordAssignmentEvent({
      rideId: "ride-3",
      driverId: "driver-3",
      event: "confirmed",
      actor: "driver",
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "driver", event: "confirmed" })
    )
  })

  // ---- Never throws ----

  it("does not throw when Supabase insert returns an error", async () => {
    mockInsert.mockResolvedValue({
      error: { message: "insert failed", code: "42P01" },
    })

    await expect(
      recordAssignmentEvent({
        rideId: "ride-4",
        event: "cancelled",
        actor: "dispatcher",
      })
    ).resolves.toBeUndefined()
  })

  it("does not throw when Supabase insert rejects", async () => {
    mockInsert.mockRejectedValue(new Error("network error"))

    await expect(
      recordAssignmentEvent({
        rideId: "ride-5",
        event: "timed_out",
        actor: "system",
      })
    ).resolves.toBeUndefined()
  })

  it("does not throw when createAdminClient throws", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    vi.mocked(createAdminClient).mockImplementationOnce(() => {
      throw new Error("missing env var")
    })

    await expect(
      recordAssignmentEvent({
        rideId: "ride-6",
        event: "reassigned",
        actor: "dispatcher",
      })
    ).resolves.toBeUndefined()
  })

  // ---- Console error logging ----

  it("logs to console.error when insert returns an error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockInsert.mockResolvedValue({ error: { message: "permission denied" } })

    await recordAssignmentEvent({
      rideId: "ride-7",
      event: "requested",
      actor: "dispatcher",
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      "[assignment-events] Failed to insert event:",
      "permission denied"
    )
    consoleSpy.mockRestore()
  })
})
