import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ rpc: mockRpc }),
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// Import after mocks
import { updateOwnContact } from "../driver-self"
import { requireAuth } from "@/lib/auth/require-auth"

const mockRequireAuth = vi.mocked(requireAuth)

const DRIVER_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44"

function asDriver(): void {
  mockRequireAuth.mockResolvedValue({
    authorized: true,
    userId: "user-1",
    role: "driver",
    driverId: DRIVER_ID,
  })
}

/** Build a FormData with the six contact fields (+ any smuggled extras). */
function contactForm(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const FULL_CONTACT = {
  phone: "044 123 45 67",
  email: "fahrer@example.com",
  street: "Bahnhofstrasse",
  house_number: "12a",
  postal_code: "8600",
  city: "Dübendorf",
}

describe("updateOwnContact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects a non-driver caller (requireAuth denies)", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      error: "Keine Berechtigung",
    })

    const result = await updateOwnContact(null, contactForm(FULL_CONTACT))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe("Keine Berechtigung")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("calls update_own_driver_contact with exactly the six whitelisted params", async () => {
    asDriver()
    mockRpc.mockResolvedValue({ error: null })

    const result = await updateOwnContact(null, contactForm(FULL_CONTACT))

    expect(result.success).toBe(true)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith("update_own_driver_contact", {
      p_phone: "044 123 45 67",
      p_email: "fahrer@example.com",
      p_street: "Bahnhofstrasse",
      p_house_number: "12a",
      p_postal_code: "8600",
      p_city: "Dübendorf",
    })
  })

  // ---------------------------------------------------------------------------
  // SECURITY FALL 3: a driver can change NEITHER is_active NOR vehicle_type NOR
  // any other field via this path. Even if the tampered form carries those keys,
  // they are dropped by the Zod whitelist and never reach the RPC.
  // ---------------------------------------------------------------------------

  it("[SEC #3] ignores smuggled is_active / vehicle_type / driver_id fields", async () => {
    asDriver()
    mockRpc.mockResolvedValue({ error: null })

    const tampered = contactForm({
      ...FULL_CONTACT,
      is_active: "false",
      vehicle_type: "bus",
      driver_id: "attacker-driver-id",
      role: "operator",
    })

    const result = await updateOwnContact(null, tampered)

    expect(result.success).toBe(true)
    const [, args] = mockRpc.mock.calls[0] as [string, Record<string, unknown>]
    // Only the six p_* whitelist params are present.
    expect(Object.keys(args).sort()).toEqual([
      "p_city",
      "p_email",
      "p_house_number",
      "p_phone",
      "p_postal_code",
      "p_street",
    ])
    // Explicitly assert none of the privileged keys leaked through.
    expect(args).not.toHaveProperty("is_active")
    expect(args).not.toHaveProperty("vehicle_type")
    expect(args).not.toHaveProperty("driver_id")
    expect(args).not.toHaveProperty("p_is_active")
    expect(args).not.toHaveProperty("p_vehicle_type")
  })

  it("[SEC #3] never forwards a client-supplied driver identity to the RPC", async () => {
    asDriver()
    mockRpc.mockResolvedValue({ error: null })

    await updateOwnContact(
      null,
      contactForm({ ...FULL_CONTACT, driver_id: "foreign-driver" })
    )

    const [, args] = mockRpc.mock.calls[0] as [string, Record<string, unknown>]
    // Identity is derived server-side by the RPC (get_user_driver_id()), so no
    // driver id of any spelling is passed.
    expect(JSON.stringify(args)).not.toContain("foreign-driver")
  })

  it("passes NULL for emptied fields (clears the column)", async () => {
    asDriver()
    mockRpc.mockResolvedValue({ error: null })

    await updateOwnContact(
      null,
      contactForm({ ...FULL_CONTACT, phone: "", street: "" })
    )

    expect(mockRpc).toHaveBeenCalledWith(
      "update_own_driver_contact",
      expect.objectContaining({ p_phone: null, p_street: null })
    )
  })

  it("returns field errors on invalid input without calling the RPC", async () => {
    asDriver()

    const result = await updateOwnContact(
      null,
      contactForm({ ...FULL_CONTACT, email: "not-an-email", postal_code: "12" })
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Bitte prüfen Sie Ihre Eingaben.")
      expect(result.fieldErrors?.email).toBeDefined()
      expect(result.fieldErrors?.postal_code).toBeDefined()
    }
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns a generic error when the RPC fails", async () => {
    asDriver()
    mockRpc.mockResolvedValue({ error: { message: "db down" } })

    const result = await updateOwnContact(null, contactForm(FULL_CONTACT))

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toBe(
        "Speichern fehlgeschlagen. Bitte versuchen Sie es erneut."
      )
  })
})
