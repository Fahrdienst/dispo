import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
//
// These tests pin the APP-LAYER intent behind two of the five #106 security
// cases. The DB (RLS + SECURITY DEFINER RPCs) is the real authority — see
// supabase/tests/m12_security.sql for the runnable DB-level assertions. Here we
// prove the server actions never HAND the database a client-controlled driver
// identity and correctly gate roles.
// ---------------------------------------------------------------------------

const { mockRpc, mockSingle } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mockSingle })),
      })),
    })),
  }),
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/mail/send-absence-decision", () => ({
  sendAbsenceDecisionNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/audit/logger", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// Import after mocks
import { requestAbsence, decideAbsence } from "../absences"
import { requireAuth } from "@/lib/auth/require-auth"
import { sendAbsenceDecisionNotification } from "@/lib/mail/send-absence-decision"

const mockRequireAuth = vi.mocked(requireAuth)
const mockSendMail = vi.mocked(sendAbsenceDecisionNotification)

const DRIVER_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"
const ABSENCE_ID = "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a55"

function absenceForm(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const VALID_REQUEST = {
  type: "vacation",
  start_date: "2026-07-20",
  end_date: "2026-07-24",
  reason: "",
}

// =============================================================================
// requestAbsence — SECURITY FALL 1 (proxy): a driver can never file for a
// foreign driver_id. The action passes ONLY p_type/p_start_date/p_end_date/
// p_reason to request_absence(); the driver identity is derived in the RPC.
// =============================================================================

describe("requestAbsence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function asDriver(): void {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      userId: "user-1",
      role: "driver",
      driverId: DRIVER_ID,
    })
  }

  it("rejects a caller without a driver profile", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      userId: "user-1",
      role: "operator",
      driverId: null,
    })

    const result = await requestAbsence(null, absenceForm(VALID_REQUEST))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Keine Berechtigung")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated caller", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      error: "Nicht authentifiziert",
    })

    const result = await requestAbsence(null, absenceForm(VALID_REQUEST))
    expect(result.success).toBe(false)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("[SEC #1] passes ONLY the four RPC params — never a client driver_id", async () => {
    asDriver()
    mockRpc.mockResolvedValue({ error: null })

    const tampered = absenceForm({
      ...VALID_REQUEST,
      driver_id: "attacker-driver-id",
      status: "approved",
    })

    const result = await requestAbsence(null, tampered)

    expect(result.success).toBe(true)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    const [fn, args] = mockRpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(fn).toBe("request_absence")
    expect(Object.keys(args).sort()).toEqual([
      "p_end_date",
      "p_reason",
      "p_start_date",
      "p_type",
    ])
    // No driver identity or forged status of any spelling is forwarded.
    expect(JSON.stringify(args)).not.toContain("attacker-driver-id")
    expect(args).not.toHaveProperty("driver_id")
    expect(args).not.toHaveProperty("status")
  })

  it("passes NULL reason through when omitted (DSGVO minimisation)", async () => {
    asDriver()
    mockRpc.mockResolvedValue({ error: null })

    await requestAbsence(null, absenceForm({ ...VALID_REQUEST, reason: "" }))

    const [, args] = mockRpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(args.p_reason).toBeNull()
  })

  it("returns field errors on invalid input without calling the RPC", async () => {
    asDriver()

    const result = await requestAbsence(
      null,
      absenceForm({ ...VALID_REQUEST, start_date: "2026-07-24", end_date: "2026-07-20" })
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.fieldErrors?.end_date).toBeDefined()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("maps the overlap exclusion violation to a friendly German message", async () => {
    asDriver()
    mockRpc.mockResolvedValue({ error: { code: "23P01", message: "conflict" } })

    const result = await requestAbsence(null, absenceForm(VALID_REQUEST))

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toContain("bereits ein Antrag oder eine genehmigte Abwesenheit")
  })

  it("maps a raw overlap-constraint message even without the SQLSTATE code", async () => {
    asDriver()
    mockRpc.mockResolvedValue({
      error: { code: null, message: "violates driver_absences_no_overlap" },
    })

    const result = await requestAbsence(null, absenceForm(VALID_REQUEST))
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain("bereits ein Antrag")
  })
})

// =============================================================================
// decideAbsence — SECURITY FALL 2 (proxy): a driver can never approve any
// absence (their own or others'). The action gates on requireAuth(admin/
// operator) and the deciding identity is stamped server-side in the RPC.
// =============================================================================

describe("decideAbsence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function asStaff(role: "admin" | "operator" = "operator"): void {
    mockRequireAuth.mockResolvedValue({
      authorized: true,
      userId: "staff-1",
      role,
      driverId: null,
    })
  }

  it("[SEC #2] rejects a driver trying to approve an absence", async () => {
    // requireAuth(["admin","operator"]) denies a driver session.
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      error: "Keine Berechtigung",
    })

    const result = await decideAbsence(ABSENCE_ID, "approved", null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Keine Berechtigung")
    expect(mockRpc).not.toHaveBeenCalled()
    // The action only ever requests the staff role gate.
    expect(mockRequireAuth).toHaveBeenCalledWith(["admin", "operator"])
  })

  it("[SEC #2] never forwards a decided_by / client identity to the RPC", async () => {
    asStaff()
    mockSingle.mockResolvedValue({ data: { status: "requested" }, error: null })
    mockRpc.mockResolvedValue({ error: null })

    await decideAbsence(ABSENCE_ID, "approved", null)

    const [fn, args] = mockRpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(fn).toBe("decide_absence")
    expect(Object.keys(args).sort()).toEqual([
      "p_absence_id",
      "p_decision",
      "p_note",
    ])
    // decided_by is stamped from auth.uid() inside the RPC, never passed in.
    expect(args).not.toHaveProperty("decided_by")
    expect(args).not.toHaveProperty("p_decided_by")
  })

  it("rejects an invalid decision value before hitting the DB", async () => {
    asStaff()

    // "cancelled" is not a valid decision per absenceDecisionSchema.
    const result = await decideAbsence(
      ABSENCE_ID,
      "cancelled" as "approved" | "rejected",
      null
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Ungültige Anfrage.")
    expect(mockSingle).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns 'not found' when the absence row is missing", async () => {
    asStaff()
    mockSingle.mockResolvedValue({ data: null, error: { message: "no rows" } })

    const result = await decideAbsence(ABSENCE_ID, "approved", null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Antrag nicht gefunden.")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("blocks a non-'requested' transition (defence in depth via canTransition)", async () => {
    asStaff()
    mockSingle.mockResolvedValue({ data: { status: "approved" }, error: null })

    const result = await decideAbsence(ABSENCE_ID, "approved", null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain("bereits entschieden")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("approves a requested absence and fires the decision mail afterwards", async () => {
    asStaff("admin")
    mockSingle.mockResolvedValue({ data: { status: "requested" }, error: null })
    mockRpc.mockResolvedValue({ error: null })

    const result = await decideAbsence(ABSENCE_ID, "rejected", "Zu kurzfristig")

    expect(result.success).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith("decide_absence", {
      p_absence_id: ABSENCE_ID,
      p_decision: "rejected",
      p_note: "Zu kurzfristig",
    })
    expect(mockSendMail).toHaveBeenCalledWith(ABSENCE_ID)
  })

  it("does NOT fail the decision when the RPC errors (surfaces a retry message)", async () => {
    asStaff()
    mockSingle.mockResolvedValue({ data: { status: "requested" }, error: null })
    mockRpc.mockResolvedValue({ error: { message: "db down" } })

    const result = await decideAbsence(ABSENCE_ID, "approved", null)

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toContain("konnte nicht gespeichert werden")
    // A failed decision must never send the notification.
    expect(mockSendMail).not.toHaveBeenCalled()
  })
})
