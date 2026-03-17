import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRpc = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}))

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// Import after mocks
import { anonymizePatient, anonymizeDriver } from "../gdpr"
import { requireAdmin } from "@/lib/auth/require-admin"

const mockRequireAdmin = vi.mocked(requireAdmin)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("anonymizePatient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validPatientId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

  it("rejects unauthenticated users", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: false,
      error: "Nicht authentifiziert",
    })

    const result = await anonymizePatient(validPatientId)
    expect(result.error).toBe("Nicht authentifiziert")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects non-admin users", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: false,
      error: "Keine Berechtigung",
    })

    const result = await anonymizePatient(validPatientId)
    expect(result.error).toBe("Keine Berechtigung")
  })

  it("rejects invalid UUID", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })

    const result = await anonymizePatient("not-a-uuid")
    expect(result.error).toBe("Ungueltige Patienten-ID")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects empty string as patient ID", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })

    const result = await anonymizePatient("")
    expect(result.error).toBe("Ungueltige Patienten-ID")
  })

  it("succeeds for valid admin and patient ID", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })
    mockRpc.mockResolvedValue({ error: null })

    const result = await anonymizePatient(validPatientId)
    expect(result.success).toBe("Patientendaten wurden anonymisiert.")
    expect(mockRpc).toHaveBeenCalledWith("anonymize_patient", {
      p_patient_id: validPatientId,
    })
  })

  it("returns specific error when patient has active rides", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })
    mockRpc.mockResolvedValue({
      error: { message: "Patient hat aktive Fahrten" },
    })

    const result = await anonymizePatient(validPatientId)
    expect(result.error).toBe(
      "Patient hat noch aktive Fahrten und kann nicht anonymisiert werden."
    )
  })

  it("returns generic error for unknown RPC failures", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })
    mockRpc.mockResolvedValue({
      error: { message: "some database error" },
    })

    const result = await anonymizePatient(validPatientId)
    expect(result.error).toBe(
      "Anonymisierung fehlgeschlagen. Bitte versuchen Sie es erneut."
    )
  })
})

describe("anonymizeDriver", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validDriverId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

  it("rejects unauthenticated users", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: false,
      error: "Nicht authentifiziert",
    })

    const result = await anonymizeDriver(validDriverId)
    expect(result.error).toBe("Nicht authentifiziert")
  })

  it("rejects invalid UUID", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })

    const result = await anonymizeDriver("bad-id")
    expect(result.error).toBe("Ungueltige Fahrer-ID")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("succeeds for valid admin and driver ID", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })
    mockRpc.mockResolvedValue({ error: null })

    const result = await anonymizeDriver(validDriverId)
    expect(result.success).toBe("Fahrerdaten wurden anonymisiert.")
    expect(mockRpc).toHaveBeenCalledWith("anonymize_driver", {
      p_driver_id: validDriverId,
    })
  })

  it("returns specific error when driver has active rides", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })
    mockRpc.mockResolvedValue({
      error: { message: "Fahrer hat aktive Fahrten" },
    })

    const result = await anonymizeDriver(validDriverId)
    expect(result.error).toBe(
      "Fahrer hat noch aktive Fahrten und kann nicht anonymisiert werden."
    )
  })

  it("returns generic error for unknown RPC failures", async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })
    mockRpc.mockResolvedValue({
      error: { message: "connection timeout" },
    })

    const result = await anonymizeDriver(validDriverId)
    expect(result.error).toBe(
      "Anonymisierung fehlgeschlagen. Bitte versuchen Sie es erneut."
    )
  })
})
