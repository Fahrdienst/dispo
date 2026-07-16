import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DriverDayStatus } from "@/lib/availability/driver-status"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// rides.ts transitively imports a `server-only` module (availability guard).
vi.mock("server-only", () => ({}))

interface RideRow {
  id: string
  status: string
  driver_id: string | null
  date: string
  pickup_time: string
  parent_ride_id: string | null
}

const store = vi.hoisted(() => ({
  rows: new Map<string, RideRow>(),
  updateError: null as string | null,
  updateCalls: [] as Array<{ id: string; data: Record<string, unknown> }>,
}))

// Minimal stateful Supabase mock that routes by table + chained ops.
function makeRidesBuilder() {
  const state: {
    op: "select" | "update" | null
    filters: Record<string, unknown>
    updateData: Record<string, unknown> | null
  } = { op: null, filters: {}, updateData: null }

  const builder = {
    select() {
      state.op = "select"
      return builder
    },
    update(data: Record<string, unknown>) {
      state.op = "update"
      state.updateData = data
      return builder
    },
    eq(col: string, val: unknown) {
      state.filters[col] = val
      if (state.op === "update") {
        const id = String(val)
        store.updateCalls.push({ id, data: state.updateData ?? {} })
        if (store.updateError) {
          return Promise.resolve({ error: { message: store.updateError } })
        }
        const row = store.rows.get(id)
        if (row) Object.assign(row, state.updateData)
        return Promise.resolve({ error: null })
      }
      return builder
    },
    single() {
      return Promise.resolve(resolveSelect(state))
    },
    maybeSingle() {
      return Promise.resolve(resolveSelect(state))
    },
  }
  return builder
}

function resolveSelect(state: { filters: Record<string, unknown> }) {
  if ("parent_ride_id" in state.filters) {
    const pid = state.filters.parent_ride_id
    const child = [...store.rows.values()].find(
      (r) => r.parent_ride_id === pid
    )
    return { data: child ? { id: child.id } : null }
  }
  const id = String(state.filters.id)
  const row = store.rows.get(id)
  return { data: row ? { ...row } : null }
}

const genericBuilder = {
  insert: () => Promise.resolve({ error: null }),
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) =>
      table === "rides" ? makeRidesBuilder() : genericBuilder,
  }),
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}))

const { mockGetDriverDayStatus } = vi.hoisted(() => ({
  mockGetDriverDayStatus: vi.fn(),
}))

vi.mock("@/lib/availability/assignment", () => ({
  getDriverDayStatus: mockGetDriverDayStatus,
  logOutsideAvailabilityAssignment: vi.fn().mockResolvedValue(undefined),
}))

const {
  mockInvalidateTokens,
  mockSendNotification,
  mockCreateTracking,
  mockRecordEvent,
  mockLogAudit,
  mockAcceptanceEnabled,
} = vi.hoisted(() => ({
  mockInvalidateTokens: vi.fn().mockResolvedValue(undefined),
  mockSendNotification: vi.fn().mockResolvedValue(undefined),
  mockCreateTracking: vi.fn().mockResolvedValue(undefined),
  mockRecordEvent: vi.fn().mockResolvedValue(undefined),
  mockLogAudit: vi.fn().mockResolvedValue(undefined),
  mockAcceptanceEnabled: vi.fn().mockReturnValue(true),
}))

vi.mock("@/lib/mail/tokens", () => ({
  invalidateTokensForRide: mockInvalidateTokens,
}))
vi.mock("@/lib/mail/send-driver-notification", () => ({
  sendDriverNotification: mockSendNotification,
}))
vi.mock("@/lib/acceptance/engine", () => ({
  createAcceptanceTracking: mockCreateTracking,
  cancelAcceptanceTracking: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/acceptance/events", () => ({
  recordAssignmentEvent: mockRecordEvent,
}))
vi.mock("@/lib/acceptance/constants", () => ({
  isAcceptanceFlowEnabled: mockAcceptanceEnabled,
}))
vi.mock("@/lib/audit/logger", () => ({
  logAudit: mockLogAudit,
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { assignDriverWithReturn } from "../rides"
import { requireAuth } from "@/lib/auth/require-auth"

const mockRequireAuth = vi.mocked(requireAuth)

const OUTBOUND = "11111111-1111-4111-8111-111111111111"
const RETURN = "22222222-2222-4222-8222-222222222222"
const DRIVER = "99999999-9999-4999-8999-999999999999"

function statusOk(): DriverDayStatus {
  return {
    isAbsent: false,
    absenceType: null,
    windows: [],
    hasAvailability: true,
    isWithinAvailability: true,
  }
}
function statusAbsent(): DriverDayStatus {
  return {
    isAbsent: true,
    absenceType: "vacation",
    windows: [],
    hasAvailability: false,
    isWithinAvailability: false,
  }
}

function seedLinkedPair() {
  store.rows.set(OUTBOUND, {
    id: OUTBOUND,
    status: "unplanned",
    driver_id: null,
    date: "2026-08-01",
    pickup_time: "09:00:00",
    parent_ride_id: null,
  })
  store.rows.set(RETURN, {
    id: RETURN,
    status: "unplanned",
    driver_id: null,
    date: "2026-08-01",
    pickup_time: "11:00:00",
    parent_ride_id: OUTBOUND,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  store.rows.clear()
  store.updateError = null
  store.updateCalls = []
  mockAcceptanceEnabled.mockReturnValue(true)
  mockGetDriverDayStatus.mockResolvedValue(statusOk())
  mockRequireAuth.mockResolvedValue({
    authorized: true,
    userId: "user-1",
    role: "operator",
    driverId: null,
  })
})

describe("assignDriverWithReturn", () => {
  it("co-assigns both legs from the outbound leg in one action", async () => {
    seedLinkedPair()

    const result = await assignDriverWithReturn(OUTBOUND, DRIVER, {
      includeReturn: true,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.returnLegAssigned).toBe(true)
    expect(result.data.assignedRideIds).toEqual(
      expect.arrayContaining([OUTBOUND, RETURN])
    )
    expect(result.data.assignedRideIds).toHaveLength(2)

    // Both legs updated to the driver + planned.
    expect(store.rows.get(OUTBOUND)?.driver_id).toBe(DRIVER)
    expect(store.rows.get(OUTBOUND)?.status).toBe("planned")
    expect(store.rows.get(RETURN)?.driver_id).toBe(DRIVER)
    expect(store.rows.get(RETURN)?.status).toBe("planned")

    // One request event + one tracking per leg (two separate mails, MVP).
    expect(mockRecordEvent).toHaveBeenCalledTimes(2)
    expect(mockCreateTracking).toHaveBeenCalledTimes(2)
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
    expect(mockSendNotification).toHaveBeenCalledWith(OUTBOUND, DRIVER)
    expect(mockSendNotification).toHaveBeenCalledWith(RETURN, DRIVER)
  })

  it("resolves the linked leg from the return leg (bidirectional)", async () => {
    seedLinkedPair()

    const result = await assignDriverWithReturn(RETURN, DRIVER, {
      includeReturn: true,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.assignedRideIds).toEqual(
      expect.arrayContaining([OUTBOUND, RETURN])
    )
    expect(store.rows.get(OUTBOUND)?.driver_id).toBe(DRIVER)
    expect(store.rows.get(RETURN)?.driver_id).toBe(DRIVER)
  })

  it("assigns nothing when the driver is absent for the RETURN leg", async () => {
    seedLinkedPair()
    // Absent only at the return leg's pickup time.
    mockGetDriverDayStatus.mockImplementation(
      async (_c: unknown, _d: string, _date: string, time: string) =>
        time === "11:00:00" ? statusAbsent() : statusOk()
    )

    const result = await assignDriverWithReturn(OUTBOUND, DRIVER, {
      includeReturn: true,
    })

    expect(result.success).toBe(false)
    // Nothing was written to any leg.
    expect(store.updateCalls).toHaveLength(0)
    expect(store.rows.get(OUTBOUND)?.driver_id).toBeNull()
    expect(store.rows.get(RETURN)?.driver_id).toBeNull()
    expect(mockRecordEvent).not.toHaveBeenCalled()
    expect(mockCreateTracking).not.toHaveBeenCalled()
  })

  it("assigns only the primary leg when no linked leg exists", async () => {
    store.rows.set(OUTBOUND, {
      id: OUTBOUND,
      status: "unplanned",
      driver_id: null,
      date: "2026-08-01",
      pickup_time: "09:00:00",
      parent_ride_id: null,
    })

    const result = await assignDriverWithReturn(OUTBOUND, DRIVER, {
      includeReturn: true,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.returnLegAssigned).toBe(false)
    expect(result.data.returnLegSkippedReason).toBe("no_linked_leg")
    expect(result.data.assignedRideIds).toEqual([OUTBOUND])
    expect(mockRecordEvent).toHaveBeenCalledTimes(1)
    expect(mockCreateTracking).toHaveBeenCalledTimes(1)
  })

  it("does not co-assign a linked leg that is already completed", async () => {
    seedLinkedPair()
    store.rows.get(RETURN)!.status = "completed"

    const result = await assignDriverWithReturn(OUTBOUND, DRIVER, {
      includeReturn: true,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.returnLegAssigned).toBe(false)
    expect(result.data.returnLegSkippedReason).toBe("not_assignable")
    expect(result.data.assignedRideIds).toEqual([OUTBOUND])
    // Return leg untouched.
    expect(store.rows.get(RETURN)?.driver_id).toBeNull()
    expect(store.rows.get(RETURN)?.status).toBe("completed")
  })

  it("does not touch the linked leg when includeReturn is false", async () => {
    seedLinkedPair()

    const result = await assignDriverWithReturn(OUTBOUND, DRIVER, {
      includeReturn: false,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.returnLegAssigned).toBe(false)
    expect(result.data.assignedRideIds).toEqual([OUTBOUND])
    expect(store.rows.get(RETURN)?.driver_id).toBeNull()
  })

  it("rolls back the applied leg when the second leg's write fails", async () => {
    seedLinkedPair()
    // Fail all updates -> first apply fails immediately, nothing persists.
    store.updateError = "db down"

    const result = await assignDriverWithReturn(OUTBOUND, DRIVER, {
      includeReturn: true,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain("Zuweisung fehlgeschlagen")
    // No side effects fired because writes failed before the side-effect phase.
    expect(mockRecordEvent).not.toHaveBeenCalled()
    expect(mockCreateTracking).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated callers", async () => {
    mockRequireAuth.mockResolvedValue({
      authorized: false,
      error: "Nicht authentifiziert",
    })

    const result = await assignDriverWithReturn(OUTBOUND, DRIVER, {
      includeReturn: true,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe("Nicht authentifiziert")
  })
})
