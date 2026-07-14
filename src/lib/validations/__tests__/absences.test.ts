import { describe, it, expect } from "vitest"
import {
  absenceRequestSchema,
  absenceDecisionSchema,
} from "../absences"

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"

function makeRequest(
  overrides: Partial<{
    type: string
    start_date: string
    end_date: string
    reason: unknown
  }> = {}
) {
  return {
    type: "vacation",
    start_date: "2026-07-20",
    end_date: "2026-07-24",
    reason: "",
    ...overrides,
  }
}

// =============================================================================
// absenceRequestSchema (Issue #102)
// =============================================================================

describe("absenceRequestSchema", () => {
  // --- Happy path ---

  it("accepts a valid vacation request", () => {
    const result = absenceRequestSchema.safeParse(makeRequest())
    expect(result.success).toBe(true)
  })

  it("accepts every absence type", () => {
    for (const type of ["vacation", "sick", "training", "other"] as const) {
      const result = absenceRequestSchema.safeParse(makeRequest({ type }))
      expect(result.success).toBe(true)
    }
  })

  it("accepts a single-day absence (end === start)", () => {
    const result = absenceRequestSchema.safeParse(
      makeRequest({ start_date: "2026-07-20", end_date: "2026-07-20" })
    )
    expect(result.success).toBe(true)
  })

  // --- Type field (required, enum-gated) ---

  it("rejects an unknown type", () => {
    const result = absenceRequestSchema.safeParse(makeRequest({ type: "holiday" }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.type).toContain(
        "Bitte einen Typ auswählen"
      )
    }
  })

  it("rejects a missing type", () => {
    const result = absenceRequestSchema.safeParse({
      start_date: "2026-07-20",
      end_date: "2026-07-24",
      reason: null,
    })
    expect(result.success).toBe(false)
  })

  // --- Date fields (required, ISO format) ---

  it("rejects a missing start_date", () => {
    const result = absenceRequestSchema.safeParse({
      type: "vacation",
      end_date: "2026-07-24",
      reason: null,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a missing end_date", () => {
    const result = absenceRequestSchema.safeParse({
      type: "vacation",
      start_date: "2026-07-20",
      reason: null,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a malformed start_date", () => {
    const result = absenceRequestSchema.safeParse(
      makeRequest({ start_date: "20.07.2026" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.start_date).toContain(
        "Ungültiges Startdatum"
      )
    }
  })

  it("rejects a malformed end_date", () => {
    const result = absenceRequestSchema.safeParse(
      makeRequest({ end_date: "2026/07/24" })
    )
    expect(result.success).toBe(false)
  })

  // --- Date-range refinement (end_date >= start_date) ---

  it("rejects an end_date before the start_date and points the error at end_date", () => {
    const result = absenceRequestSchema.safeParse(
      makeRequest({ start_date: "2026-07-24", end_date: "2026-07-20" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.end_date).toContain(
        "Das Enddatum darf nicht vor dem Startdatum liegen"
      )
    }
  })

  // --- reason (optional, empty→null, DSGVO data minimisation) ---

  it("coerces an empty reason to null", () => {
    const result = absenceRequestSchema.safeParse(makeRequest({ reason: "" }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBeNull()
    }
  })

  it("coerces a whitespace-only reason to null", () => {
    const result = absenceRequestSchema.safeParse(makeRequest({ reason: "   " }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBeNull()
    }
  })

  it("accepts an explicit null reason", () => {
    const result = absenceRequestSchema.safeParse(makeRequest({ reason: null }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBeNull()
    }
  })

  it("keeps a provided reason", () => {
    const result = absenceRequestSchema.safeParse(
      makeRequest({ reason: "Familienurlaub" })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBe("Familienurlaub")
    }
  })

  it("does NOT require a reason for a sick absence (must never force health data)", () => {
    const result = absenceRequestSchema.safeParse(
      makeRequest({ type: "sick", reason: "" })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBeNull()
    }
  })

  it("rejects a reason longer than 500 characters", () => {
    const result = absenceRequestSchema.safeParse(
      makeRequest({ reason: "x".repeat(501) })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.reason).toContain(
        "Begründung ist zu lang (max. 500 Zeichen)"
      )
    }
  })

  it("accepts a reason of exactly 500 characters", () => {
    const result = absenceRequestSchema.safeParse(
      makeRequest({ reason: "x".repeat(500) })
    )
    expect(result.success).toBe(true)
  })

  // --- No client-controlled driver identity leaks into the parsed shape ---

  it("never surfaces a client-supplied driver_id (identity is server-derived)", () => {
    const result = absenceRequestSchema.safeParse({
      ...makeRequest(),
      driver_id: "attacker-driver-id",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("driver_id")
    }
  })
})

// =============================================================================
// absenceDecisionSchema (Issue #103)
// =============================================================================

describe("absenceDecisionSchema", () => {
  function makeDecision(
    overrides: Partial<{
      absence_id: string
      decision: string
      note: unknown
    }> = {}
  ) {
    return {
      absence_id: VALID_UUID,
      decision: "approved",
      note: "",
      ...overrides,
    }
  }

  it("accepts an approve decision", () => {
    const result = absenceDecisionSchema.safeParse(makeDecision())
    expect(result.success).toBe(true)
  })

  it("accepts a reject decision", () => {
    const result = absenceDecisionSchema.safeParse(
      makeDecision({ decision: "rejected" })
    )
    expect(result.success).toBe(true)
  })

  it("rejects 'cancelled' as a decision (only approve/reject are valid)", () => {
    const result = absenceDecisionSchema.safeParse(
      makeDecision({ decision: "cancelled" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.decision).toContain(
        "Ungültige Entscheidung"
      )
    }
  })

  it("rejects 'requested' as a decision", () => {
    const result = absenceDecisionSchema.safeParse(
      makeDecision({ decision: "requested" })
    )
    expect(result.success).toBe(false)
  })

  it("rejects a non-UUID absence_id", () => {
    const result = absenceDecisionSchema.safeParse(
      makeDecision({ absence_id: "not-a-uuid" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.absence_id).toContain(
        "Ungültige Antrags-ID"
      )
    }
  })

  it("coerces an empty note to null", () => {
    const result = absenceDecisionSchema.safeParse(makeDecision({ note: "" }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.note).toBeNull()
    }
  })

  it("keeps a provided rejection note", () => {
    const result = absenceDecisionSchema.safeParse(
      makeDecision({ decision: "rejected", note: "Zu kurzfristig" })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.note).toBe("Zu kurzfristig")
    }
  })

  it("rejects a note longer than 500 characters", () => {
    const result = absenceDecisionSchema.safeParse(
      makeDecision({ note: "x".repeat(501) })
    )
    expect(result.success).toBe(false)
  })
})
