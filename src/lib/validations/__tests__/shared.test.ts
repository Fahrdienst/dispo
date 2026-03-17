import { describe, it, expect } from "vitest"
import { uuidSchema } from "../shared"

describe("uuidSchema", () => {
  // ---- Valid UUIDs ----

  it("accepts a valid v4 UUID", () => {
    const result = uuidSchema.safeParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
    expect(result.success).toBe(true)
  })

  it("accepts a valid v4 UUID with uppercase letters", () => {
    const result = uuidSchema.safeParse("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11")
    expect(result.success).toBe(true)
  })

  it("accepts a nil UUID (all zeros)", () => {
    const result = uuidSchema.safeParse("00000000-0000-0000-0000-000000000000")
    expect(result.success).toBe(true)
  })

  // ---- Invalid UUIDs ----

  it("rejects an empty string", () => {
    const result = uuidSchema.safeParse("")
    expect(result.success).toBe(false)
  })

  it("rejects a random string", () => {
    const result = uuidSchema.safeParse("not-a-uuid")
    expect(result.success).toBe(false)
  })

  it("rejects a UUID without dashes", () => {
    const result = uuidSchema.safeParse("a0eebc999c0b4ef8bb6d6bb9bd380a11")
    expect(result.success).toBe(false)
  })

  it("rejects a UUID with extra characters", () => {
    const result = uuidSchema.safeParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11x")
    expect(result.success).toBe(false)
  })

  it("rejects a UUID that is too short", () => {
    const result = uuidSchema.safeParse("a0eebc99-9c0b-4ef8-bb6d")
    expect(result.success).toBe(false)
  })

  it("rejects null", () => {
    const result = uuidSchema.safeParse(null)
    expect(result.success).toBe(false)
  })

  it("rejects undefined", () => {
    const result = uuidSchema.safeParse(undefined)
    expect(result.success).toBe(false)
  })

  it("rejects a number", () => {
    const result = uuidSchema.safeParse(12345)
    expect(result.success).toBe(false)
  })

  // ---- Error message ----

  it("returns the custom error message for invalid input", () => {
    const result = uuidSchema.safeParse("bad")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Ungültige ID")
    }
  })
})
