import { describe, it, expect } from "vitest"
import {
  buildBatchCandidates,
  type BatchRideRow,
} from "@/lib/receipts/batch-queries"

const P1 = "11111111-1111-4111-8111-111111111111"
const P2 = "22222222-2222-4222-8222-222222222222"

function row(partial: Partial<BatchRideRow> & { rideId: string; patientId: string }): BatchRideRow {
  return {
    patientName: "Patient",
    hasEmail: false,
    amount: 10,
    ...partial,
  }
}

describe("buildBatchCandidates", () => {
  it("groups rides by patient with count, sum and ride-id list", () => {
    const result = buildBatchCandidates([
      row({ rideId: "r1", patientId: P1, patientName: "Anna", amount: 12.5 }),
      row({ rideId: "r2", patientId: P1, patientName: "Anna", amount: 12.5 }),
      row({ rideId: "r3", patientId: P2, patientName: "Bruno", amount: 8 }),
    ])

    expect(result).toHaveLength(2)
    const anna = result.find((c) => c.patientId === P1)
    expect(anna?.rideCount).toBe(2)
    expect(anna?.total).toBe(25)
    expect(anna?.rideIds).toEqual(["r1", "r2"])

    const bruno = result.find((c) => c.patientId === P2)
    expect(bruno?.rideCount).toBe(1)
    expect(bruno?.total).toBe(8)
  })

  it("excludes priceless rides from rideIds/total but counts them separately", () => {
    const result = buildBatchCandidates([
      row({ rideId: "r1", patientId: P1, patientName: "Anna", amount: 20 }),
      row({ rideId: "r2", patientId: P1, patientName: "Anna", amount: null }),
    ])

    const anna = result[0]
    expect(anna?.rideCount).toBe(1)
    expect(anna?.rideIds).toEqual(["r1"])
    expect(anna?.total).toBe(20)
    expect(anna?.pricelessCount).toBe(1)
  })

  it("keeps a patient with only priceless rides, but not runnable", () => {
    const result = buildBatchCandidates([
      row({ rideId: "r1", patientId: P1, patientName: "Anna", amount: null }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.rideCount).toBe(0)
    expect(result[0]?.rideIds).toEqual([])
    expect(result[0]?.pricelessCount).toBe(1)
    expect(result[0]?.total).toBe(0)
  })

  it("sums with rounding safety (no floating-point drift)", () => {
    const result = buildBatchCandidates([
      row({ rideId: "r1", patientId: P1, amount: 0.1 }),
      row({ rideId: "r2", patientId: P1, amount: 0.2 }),
    ])
    expect(result[0]?.total).toBe(0.3)
  })

  it("sorts candidates by patient name (de)", () => {
    const result = buildBatchCandidates([
      row({ rideId: "r1", patientId: P2, patientName: "Zora" }),
      row({ rideId: "r2", patientId: P1, patientName: "Ätna" }),
    ])
    expect(result.map((c) => c.patientName)).toEqual(["Ätna", "Zora"])
  })

  it("carries the e-mail flag through", () => {
    const result = buildBatchCandidates([
      row({ rideId: "r1", patientId: P1, hasEmail: true }),
    ])
    expect(result[0]?.hasEmail).toBe(true)
  })
})
