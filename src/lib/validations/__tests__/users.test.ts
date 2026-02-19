import { describe, it, expect } from "vitest"
import { createUserSchema, updateUserSchema } from "../users"

// driver_id has .uuid() before .transform(), so omit it for non-driver roles
const validCreateUser = {
  email: "test@example.com",
  password: "securePassword123",
  display_name: "Test User",
  role: "operator" as const,
}

const validUpdateUser = {
  display_name: "Updated User",
  role: "operator" as const,
}

describe("createUserSchema", () => {
  it("accepts valid input", () => {
    const result = createUserSchema.safeParse(validCreateUser)
    expect(result.success).toBe(true)
  })

  // --- Required fields ---

  it("rejects empty email", () => {
    const result = createUserSchema.safeParse({ ...validCreateUser, email: "" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid email format", () => {
    const result = createUserSchema.safeParse({ ...validCreateUser, email: "not-an-email" })
    expect(result.success).toBe(false)
  })

  it("rejects empty password", () => {
    const result = createUserSchema.safeParse({ ...validCreateUser, password: "" })
    expect(result.success).toBe(false)
  })

  it("rejects password shorter than 8 chars", () => {
    const result = createUserSchema.safeParse({ ...validCreateUser, password: "short" })
    expect(result.success).toBe(false)
  })

  it("rejects password longer than 72 chars", () => {
    const result = createUserSchema.safeParse({ ...validCreateUser, password: "A".repeat(73) })
    expect(result.success).toBe(false)
  })

  it("rejects empty display_name", () => {
    const result = createUserSchema.safeParse({ ...validCreateUser, display_name: "" })
    expect(result.success).toBe(false)
  })

  // --- Max length ---

  it("rejects email over 254 chars", () => {
    const longEmail = "a".repeat(246) + "@test.com" // 255 chars
    const result = createUserSchema.safeParse({ ...validCreateUser, email: longEmail })
    expect(result.success).toBe(false)
  })

  it("rejects display_name over 100 chars", () => {
    const result = createUserSchema.safeParse({ ...validCreateUser, display_name: "A".repeat(101) })
    expect(result.success).toBe(false)
  })

  // --- Email transforms ---

  it("lowercases email", () => {
    const result = createUserSchema.safeParse({
      ...validCreateUser,
      email: "Test@Example.COM",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe("test@example.com")
    }
  })

  // --- Role enum ---

  it("accepts all valid roles", () => {
    for (const role of ["admin", "operator", "driver"] as const) {
      const data = role === "driver"
        ? { ...validCreateUser, role, driver_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }
        : { ...validCreateUser, role }
      const result = createUserSchema.safeParse(data)
      expect(result.success).toBe(true)
    }
  })

  it("rejects invalid role", () => {
    const result = createUserSchema.safeParse({ ...validCreateUser, role: "superadmin" })
    expect(result.success).toBe(false)
  })

  // --- Cross-field refinement: driver_id required when role=driver ---

  it("requires driver_id when role is driver", () => {
    const result = createUserSchema.safeParse({
      ...validCreateUser,
      role: "driver",
      // driver_id omitted — refinement should reject
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const driverIdErrors = result.error.issues.filter((i) => i.path.includes("driver_id"))
      expect(driverIdErrors.length).toBeGreaterThan(0)
    }
  })

  it("rejects non-uuid driver_id", () => {
    const result = createUserSchema.safeParse({
      ...validCreateUser,
      role: "driver",
      driver_id: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("accepts driver role with valid driver_id", () => {
    const result = createUserSchema.safeParse({
      ...validCreateUser,
      role: "driver",
      driver_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    })
    expect(result.success).toBe(true)
  })

  it("rejects driver_id when role is not driver", () => {
    const result = createUserSchema.safeParse({
      ...validCreateUser,
      role: "admin",
      driver_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const driverIdErrors = result.error.issues.filter((i) => i.path.includes("driver_id"))
      expect(driverIdErrors.length).toBeGreaterThan(0)
    }
  })

  // --- driver_id omitted for non-driver role is valid ---

  it("accepts omitted driver_id for non-driver role", () => {
    const result = createUserSchema.safeParse(validCreateUser)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.driver_id).toBeUndefined()
    }
  })
})

describe("updateUserSchema", () => {
  it("accepts valid input", () => {
    const result = updateUserSchema.safeParse(validUpdateUser)
    expect(result.success).toBe(true)
  })

  it("rejects empty display_name", () => {
    const result = updateUserSchema.safeParse({ ...validUpdateUser, display_name: "" })
    expect(result.success).toBe(false)
  })

  it("requires driver_id when role is driver", () => {
    const result = updateUserSchema.safeParse({
      ...validUpdateUser,
      role: "driver",
      // driver_id omitted
    })
    expect(result.success).toBe(false)
  })

  it("accepts driver role with valid driver_id", () => {
    const result = updateUserSchema.safeParse({
      ...validUpdateUser,
      role: "driver",
      driver_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    })
    expect(result.success).toBe(true)
  })

  it("rejects driver_id when role is not driver", () => {
    const result = updateUserSchema.safeParse({
      ...validUpdateUser,
      role: "operator",
      driver_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    })
    expect(result.success).toBe(false)
  })

  it("accepts omitted driver_id for non-driver role", () => {
    const result = updateUserSchema.safeParse(validUpdateUser)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.driver_id).toBeUndefined()
    }
  })
})
