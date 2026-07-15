import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks. The DB triggers (item propagation, immutability) are the real
// authority — see supabase/migrations/20260718_000001_receipts_core.sql. Here
// we pin the APP-LAYER intent for Issue #149: the reason is mandatory, an
// already-cancelled receipt is rejected, and a successful storno is audited
// under action='cancel' (SEC-M14-006).
// ---------------------------------------------------------------------------

const { mockLoadSingle, mockUpdateResult } = vi.hoisted(() => ({
  mockLoadSingle: vi.fn(),
  mockUpdateResult: { error: null as { message: string } | null },
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mockLoadSingle })),
      })),
    })),
  }),
}))

vi.mock("@/lib/supabase/admin", () => {
  // Chainable update() → eq() → eq() … that is also awaitable.
  function makeQuery() {
    const q: Record<string, unknown> = {}
    q.eq = vi.fn(() => q)
    q.then = (resolve: (v: typeof mockUpdateResult) => unknown) =>
      resolve(mockUpdateResult)
    return q
  }
  return {
    createAdminClient: vi.fn(() => ({
      from: vi.fn(() => ({
        update: vi.fn(() => makeQuery()),
      })),
    })),
  }
})

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/audit/logger", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { cancelReceipt } from "../receipt-cancel"
import { requireAuth } from "@/lib/auth/require-auth"
import { logAudit } from "@/lib/audit/logger"

const mockRequireAuth = vi.mocked(requireAuth)
const mockLogAudit = vi.mocked(logAudit)

const RECEIPT_ID = "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a55"

function asStaff(role: "admin" | "operator" = "operator") {
  mockRequireAuth.mockResolvedValue({
    authorized: true,
    userId: "staff-1",
    role,
    driverId: null,
  })
}

describe("cancelReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateResult.error = null
  })

  it("rejects an unauthorised caller before touching the DB", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      error: "Keine Berechtigung",
    })

    const result = await cancelReceipt({ receiptId: RECEIPT_ID, reason: "Fehler" })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Keine Berechtigung")
    expect(mockLoadSingle).not.toHaveBeenCalled()
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("requires a non-empty reason (Begründungspflicht)", async () => {
    asStaff()

    const result = await cancelReceipt({ receiptId: RECEIPT_ID, reason: "  " })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain("Begründung")
    // Validation happens before any DB load.
    expect(mockLoadSingle).not.toHaveBeenCalled()
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("rejects an already-cancelled receipt", async () => {
    asStaff()
    mockLoadSingle.mockResolvedValue({
      data: { id: RECEIPT_ID, status: "cancelled", receipt_number: "Q-2026-00042" },
      error: null,
    })

    const result = await cancelReceipt({
      receiptId: RECEIPT_ID,
      reason: "Doppelt erstellt",
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain("bereits storniert")
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("returns 'not found' when the receipt is missing", async () => {
    asStaff()
    mockLoadSingle.mockResolvedValue({ data: null, error: { message: "no rows" } })

    const result = await cancelReceipt({ receiptId: RECEIPT_ID, reason: "Fehler" })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Beleg nicht gefunden.")
  })

  it("cancels an issued receipt and audits it under action='cancel'", async () => {
    asStaff("admin")
    mockLoadSingle.mockResolvedValue({
      data: { id: RECEIPT_ID, status: "issued", receipt_number: "Q-2026-00042" },
      error: null,
    })

    const result = await cancelReceipt({
      receiptId: RECEIPT_ID,
      reason: "Falscher Zeitraum",
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.receiptNumber).toBe("Q-2026-00042")

    expect(mockLogAudit).toHaveBeenCalledTimes(1)
    const auditArg = mockLogAudit.mock.calls[0]?.[0]
    expect(auditArg).toMatchObject({
      action: "cancel",
      entityType: "receipt",
      entityId: RECEIPT_ID,
    })
    expect(auditArg?.metadata).toMatchObject({
      receipt_number: "Q-2026-00042",
      cancelled_reason: "Falscher Zeitraum",
    })
  })

  it("surfaces a retry message and does not audit when the update fails", async () => {
    asStaff()
    mockLoadSingle.mockResolvedValue({
      data: { id: RECEIPT_ID, status: "issued", receipt_number: "Q-2026-00042" },
      error: null,
    })
    mockUpdateResult.error = { message: "db down" }

    const result = await cancelReceipt({ receiptId: RECEIPT_ID, reason: "Fehler" })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain("nicht storniert")
    expect(mockLogAudit).not.toHaveBeenCalled()
  })
})
