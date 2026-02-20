import { describe, it, expect } from "vitest"
import { generateToken } from "../tokens"

describe("generateToken", () => {
  it("returns a 64-character hex string (256-bit)", () => {
    const token = generateToken()
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(tokens.size).toBe(100)
  })
})
