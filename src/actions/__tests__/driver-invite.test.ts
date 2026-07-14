import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks (see rides.test.ts / gdpr.test.ts for the established patterns).
//
// inviteDriver (Issue #94) is the CORE security path of M12: handle_new_user()
// defaults every fresh profile to role='operator' (SEC-001), so this action MUST
// explicitly correct the profile to role='driver' + driver_id, and roll the auth
// user back if that correction fails. These tests pin exactly that behaviour.
// ---------------------------------------------------------------------------

const {
  mockCreateUser,
  mockDeleteUser,
  mockAdminUpdateSelect,
  mockResetPassword,
  serverLookups,
} = vi.hoisted(() => ({
  mockCreateUser: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockAdminUpdateSelect: vi.fn(),
  mockResetPassword: vi.fn(),
  // Configurable results for the three server-side maybeSingle() lookups,
  // keyed by "<table>:<filter-column>".
  serverLookups: {
    map: new Map<string, { data: unknown }>(),
  },
}))

// Build a chainable server-client query builder that records the table it was
// opened on and the last .eq() column, then resolves maybeSingle() from the map.
function makeServerBuilder(table: string) {
  const builder: {
    _col: string | null
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
  } = {
    _col: null,
    select: vi.fn(() => builder),
    eq: vi.fn((col: string) => {
      builder._col = col
      return builder
    }),
    maybeSingle: vi.fn(() =>
      Promise.resolve(
        serverLookups.map.get(`${table}:${builder._col}`) ?? { data: null }
      )
    ),
  }
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => makeServerBuilder(table)),
    auth: {
      resetPasswordForEmail: mockResetPassword,
    },
  }),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
    // adminClient.from("profiles").update(...).eq(...).select("id")
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: mockAdminUpdateSelect,
        })),
      })),
    })),
  })),
}))

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}))

// Keep audit logging silent (fire-and-forget) so it does not hit the real admin
// client / env vars.
vi.mock("@/lib/audit/logger", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { inviteDriver } from "../driver-invite"
import { requireAdmin } from "@/lib/auth/require-admin"

const mockRequireAdmin = vi.mocked(requireAdmin)

const DRIVER_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
const NEW_USER_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"
const EMAIL = "fahrer@example.com"

/** Configure the happy-path preconditions; individual tests override as needed. */
function primeHappyPath(): void {
  mockRequireAdmin.mockResolvedValue({ authorized: true, userId: "admin-1" })
  serverLookups.map.set("drivers:id", {
    data: { id: DRIVER_ID, first_name: "Max", last_name: "Muster", is_active: true },
  })
  serverLookups.map.set("profiles:driver_id", { data: null }) // not invited yet
  serverLookups.map.set("profiles:email", { data: null }) // email free
  mockCreateUser.mockResolvedValue({
    data: { user: { id: NEW_USER_ID, created_at: "2026-07-14T10:00:00Z" } },
    error: null,
  })
  mockAdminUpdateSelect.mockResolvedValue({ data: [{ id: NEW_USER_ID }], error: null })
  mockResetPassword.mockResolvedValue({ error: null })
  mockDeleteUser.mockResolvedValue({ error: null })
}

describe("inviteDriver", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serverLookups.map.clear()
  })

  // -----------------------------------------------------------------------
  // Input / authorization guards
  // -----------------------------------------------------------------------

  it("rejects an invalid driver id before touching anything", async () => {
    const result = await inviteDriver("not-a-uuid", EMAIL)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Ungültige Fahrer-ID")
    expect(mockRequireAdmin).not.toHaveBeenCalled()
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it("rejects a malformed email", async () => {
    const result = await inviteDriver(DRIVER_ID, "not-an-email")
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Ungültige E-Mail-Adresse")
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it("rejects a non-admin caller", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: false,
      error: "Keine Berechtigung",
    })
    const result = await inviteDriver(DRIVER_ID, EMAIL)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Keine Berechtigung")
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it("rejects inviting an inactive driver", async () => {
    mockRequireAdmin.mockResolvedValue({ authorized: true, userId: "admin-1" })
    serverLookups.map.set("drivers:id", {
      data: { id: DRIVER_ID, first_name: "Max", last_name: "Muster", is_active: false },
    })
    const result = await inviteDriver(DRIVER_ID, EMAIL)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toBe("Inaktive Fahrer können nicht eingeladen werden")
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it("is idempotent: refuses a second invite when a profile is already linked", async () => {
    primeHappyPath()
    serverLookups.map.set("profiles:driver_id", { data: { id: "existing-user" } })
    const result = await inviteDriver(DRIVER_ID, EMAIL)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toBe("Dieser Fahrer wurde bereits eingeladen")
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it("refuses an email already used by another account", async () => {
    primeHappyPath()
    serverLookups.map.set("profiles:email", { data: { id: "someone-else" } })
    const result = await inviteDriver(DRIVER_ID, EMAIL)
    expect(result.success).toBe(false)
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // SECURITY FALL 5: an invited driver becomes role='driver', NEVER 'operator'
  // -----------------------------------------------------------------------

  it("[SEC #5] corrects the operator-defaulted profile to role='driver' + driver_id", async () => {
    primeHappyPath()

    const result = await inviteDriver(DRIVER_ID, EMAIL)

    expect(result.success).toBe(true)
    // The correction update must set BOTH role='driver' AND the driver link.
    expect(mockAdminUpdateSelect).toHaveBeenCalledTimes(1)
    // Inspect the exact object passed to .update(...). We reach it via the
    // createAdminClient mock's from().update() call args.
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const adminInstance = vi.mocked(createAdminClient).mock.results[0]?.value as {
      from: ReturnType<typeof vi.fn>
    }
    const updateFn = adminInstance.from.mock.results[0]?.value.update as ReturnType<
      typeof vi.fn
    >
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ role: "driver", driver_id: DRIVER_ID })
    )
  })

  it("[SEC #5] enforces order createUser → correct profile → send invite mail", async () => {
    primeHappyPath()

    await inviteDriver(DRIVER_ID, EMAIL)

    const createOrder = mockCreateUser.mock.invocationCallOrder[0] ?? 0
    const correctOrder = mockAdminUpdateSelect.mock.invocationCallOrder[0] ?? 0
    const mailOrder = mockResetPassword.mock.invocationCallOrder[0] ?? 0

    expect(createOrder).toBeGreaterThan(0)
    expect(correctOrder).toBeGreaterThan(createOrder)
    expect(mailOrder).toBeGreaterThan(correctOrder)
  })

  it("[SEC #5] does NOT send the invite mail before the role is corrected", async () => {
    primeHappyPath()
    // Correction fails -> mail must never go out on an operator-privileged account.
    mockAdminUpdateSelect.mockResolvedValue({ data: [], error: null })

    const result = await inviteDriver(DRIVER_ID, EMAIL)

    expect(result.success).toBe(false)
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // Rollback: a failed correction must delete the orphaned auth user
  // -----------------------------------------------------------------------

  it("[SEC #5] rolls the auth user back when the correction updates zero rows", async () => {
    primeHappyPath()
    mockAdminUpdateSelect.mockResolvedValue({ data: [], error: null })

    const result = await inviteDriver(DRIVER_ID, EMAIL)

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toBe(
        "Fahrer-Profil konnte nicht verknüpft werden. Einladung abgebrochen."
      )
    expect(mockDeleteUser).toHaveBeenCalledWith(NEW_USER_ID)
  })

  it("[SEC #5] rolls back when the correction returns a DB error", async () => {
    primeHappyPath()
    mockAdminUpdateSelect.mockResolvedValue({
      data: null,
      error: { message: "update failed" },
    })

    const result = await inviteDriver(DRIVER_ID, EMAIL)

    expect(result.success).toBe(false)
    expect(mockDeleteUser).toHaveBeenCalledWith(NEW_USER_ID)
  })

  it("surfaces a loud error when even the rollback deleteUser fails", async () => {
    primeHappyPath()
    mockAdminUpdateSelect.mockResolvedValue({ data: [], error: null })
    mockDeleteUser.mockResolvedValue({ error: { message: "delete failed" } })

    const result = await inviteDriver(DRIVER_ID, EMAIL)

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toContain("automatische Bereinigung schlug fehl")
  })

  // -----------------------------------------------------------------------
  // createUser failure paths
  // -----------------------------------------------------------------------

  it("returns a friendly error when the email is already registered in auth", async () => {
    primeHappyPath()
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email has already been registered" },
    })

    const result = await inviteDriver(DRIVER_ID, EMAIL)

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toBe("Diese E-Mail-Adresse wird bereits verwendet")
    expect(mockAdminUpdateSelect).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // Mail failure AFTER a valid driver is provisioned
  // -----------------------------------------------------------------------

  it("keeps the provisioned driver but reports a resend hint when the mail fails", async () => {
    primeHappyPath()
    mockResetPassword.mockResolvedValue({ error: { message: "smtp down" } })

    const result = await inviteDriver(DRIVER_ID, EMAIL)

    expect(result.success).toBe(false)
    // A valid, correctly-linked driver must NOT be rolled back over a mail failure.
    expect(mockDeleteUser).not.toHaveBeenCalled()
    if (!result.success)
      expect(result.error).toContain("Einladungs-E-Mail konnte nicht gesendet werden")
  })

  // -----------------------------------------------------------------------
  // Happy path result shape
  // -----------------------------------------------------------------------

  it("returns state='invited' with the normalized email on success", async () => {
    primeHappyPath()

    const result = await inviteDriver(DRIVER_ID, "Fahrer@Example.com")

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status.state).toBe("invited")
      if (result.data.status.state === "invited") {
        // forgotPasswordSchema lowercases + trims the email.
        expect(result.data.status.email).toBe(EMAIL)
      }
    }
    // The reset mail is sent to the normalized address.
    expect(mockResetPassword).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ redirectTo: expect.stringContaining("/passwort-setzen") })
    )
  })
})
