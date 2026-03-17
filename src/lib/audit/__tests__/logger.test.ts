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
import { logAudit } from "../logger"

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseEntry = {
    userId: "user-123",
    userRole: "admin",
    action: "create" as const,
    entityType: "ride" as const,
    entityId: "ride-456",
  }

  it("inserts an audit log entry on success", async () => {
    mockInsert.mockResolvedValue({ error: null })

    await logAudit(baseEntry)

    expect(mockInsert).toHaveBeenCalledOnce()
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      user_role: "admin",
      action: "create",
      entity_type: "ride",
      entity_id: "ride-456",
      changes: null,
      metadata: null,
    })
  })

  it("passes changes and metadata when provided", async () => {
    mockInsert.mockResolvedValue({ error: null })

    await logAudit({
      ...baseEntry,
      changes: { status: { old: "planned", new: "confirmed" } },
      metadata: { ip: "127.0.0.1" },
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: { status: { old: "planned", new: "confirmed" } },
        metadata: { ip: "127.0.0.1" },
      })
    )
  })

  it("sets entityId to null when not provided", async () => {
    mockInsert.mockResolvedValue({ error: null })

    await logAudit({
      userId: "user-123",
      userRole: "admin",
      action: "login",
      entityType: "user",
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: null,
      })
    )
  })

  // ---- Never throws ----

  it("does not throw when Supabase insert returns an error", async () => {
    mockInsert.mockResolvedValue({
      error: { message: "insert failed", code: "42P01" },
    })

    // Should not throw
    await expect(logAudit(baseEntry)).resolves.toBeUndefined()
  })

  it("does not throw when Supabase insert rejects", async () => {
    mockInsert.mockRejectedValue(new Error("network error"))

    // Should not throw
    await expect(logAudit(baseEntry)).resolves.toBeUndefined()
  })

  it("does not throw when createAdminClient throws", async () => {
    // Re-mock to throw
    const { createAdminClient } = await import("@/lib/supabase/admin")
    vi.mocked(createAdminClient).mockImplementationOnce(() => {
      throw new Error("missing env var")
    })

    await expect(logAudit(baseEntry)).resolves.toBeUndefined()
  })

  // ---- Console error logging ----

  it("logs to console.error when insert returns an error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockInsert.mockResolvedValue({
      error: { message: "permission denied" },
    })

    await logAudit(baseEntry)

    expect(consoleSpy).toHaveBeenCalledWith(
      "[audit] Failed to insert audit log:",
      "permission denied"
    )
    consoleSpy.mockRestore()
  })

  it("logs to console.error when insert throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockInsert.mockRejectedValue(new Error("boom"))

    await logAudit(baseEntry)

    expect(consoleSpy).toHaveBeenCalledWith(
      "[audit] Failed to log:",
      expect.any(Error)
    )
    consoleSpy.mockRestore()
  })
})
