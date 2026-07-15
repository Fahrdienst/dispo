import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks. The recipient resolution / PDF attachment / mail_log write live in
// sendReceiptMail (mocked here). These tests pin the action contract for Issue
// #151: role gating, the missing-email fallback surfaces a clean error without
// auditing a disclosure, and a successful send is audited.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/mail/receipt-mail", () => ({
  sendReceiptMail: vi.fn(),
}))

vi.mock("@/lib/audit/logger", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { emailReceipt } from "../receipt-email"
import { requireAuth } from "@/lib/auth/require-auth"
import { sendReceiptMail } from "@/lib/mail/receipt-mail"
import { logAudit } from "@/lib/audit/logger"

const mockRequireAuth = vi.mocked(requireAuth)
const mockSend = vi.mocked(sendReceiptMail)
const mockLogAudit = vi.mocked(logAudit)

const RECEIPT_ID = "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a55"

function asStaff() {
  mockRequireAuth.mockResolvedValue({
    authorized: true,
    userId: "staff-1",
    role: "operator",
    driverId: null,
  })
}

describe("emailReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects an unauthorised caller before sending", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      error: "Keine Berechtigung",
    })

    const result = await emailReceipt(RECEIPT_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Keine Berechtigung")
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("surfaces the missing-email fallback without auditing a disclosure", async () => {
    asStaff()
    mockSend.mockResolvedValue({
      ok: false,
      error: "Keine E-Mail-Adresse hinterlegt.",
    })

    const result = await emailReceipt(RECEIPT_ID)

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toBe("Keine E-Mail-Adresse hinterlegt.")
    // No mail left the system => nothing to audit as a disclosure.
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("surfaces a send failure as a mail problem (not a receipt problem)", async () => {
    asStaff()
    mockSend.mockResolvedValue({
      ok: false,
      error: "Die E-Mail konnte nicht versendet werden. Bitte versuchen Sie es erneut.",
    })

    const result = await emailReceipt(RECEIPT_ID)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain("nicht versendet")
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it("audits the disclosure on a successful send", async () => {
    asStaff()
    mockSend.mockResolvedValue({ ok: true, recipient: "maria@example.com" })

    const result = await emailReceipt(RECEIPT_ID)

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.recipient).toBe("maria@example.com")

    expect(mockSend).toHaveBeenCalledWith(RECEIPT_ID)
    expect(mockLogAudit).toHaveBeenCalledTimes(1)
    const auditArg = mockLogAudit.mock.calls[0]?.[0]
    expect(auditArg).toMatchObject({
      action: "update",
      entityType: "receipt",
      entityId: RECEIPT_ID,
    })
    expect(auditArg?.metadata).toMatchObject({
      event: "receipt_emailed",
      recipient: "maria@example.com",
    })
  })
})
