import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted() so variables are available in vi.mock() factories
// ---------------------------------------------------------------------------

const { mockSingle, mockUpdateEq } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockUpdateEq: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: mockUpdateEq.mockResolvedValue({ error: null }),
      }),
    }),
  }),
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { updateRideStatus } from "../rides"
import { requireAuth } from "@/lib/auth/require-auth"

const mockRequireAuth = vi.mocked(requireAuth)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("updateRideStatus", () => {
  const rideId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  const driverId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects an invalid state transition", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      userId: "user-1",
      role: "admin",
      driverId: null,
    })
    mockSingle.mockResolvedValue({
      data: { status: "unplanned", driver_id: null },
    })

    const result = await updateRideStatus(rideId, "completed")

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Ungültiger Statusübergang")
    }
  })

  it("rejects an unauthorized role (driver trying to cancel)", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      userId: "user-2",
      role: "driver",
      driverId,
    })
    mockSingle.mockResolvedValue({
      data: { status: "confirmed", driver_id: driverId },
    })

    const result = await updateRideStatus(rideId, "cancelled")

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Ungültiger Statusübergang")
    }
  })

  it("succeeds for a valid role and transition", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      userId: "user-1",
      role: "admin",
      driverId: null,
    })
    mockSingle.mockResolvedValue({
      data: { status: "planned", driver_id: driverId },
    })

    const result = await updateRideStatus(rideId, "confirmed")

    expect(result.success).toBe(true)
  })

  it("rejects unauthenticated users", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      error: "Nicht authentifiziert",
    })

    const result = await updateRideStatus(rideId, "confirmed")

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Nicht authentifiziert")
    }
  })
})
