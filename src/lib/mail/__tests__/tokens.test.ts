import { describe, it, expect } from "vitest"
import { generateToken, hashToken } from "../tokens"

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

describe("hashToken", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashToken("test-token")
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is deterministic (same input → same output)", () => {
    const token = "my-secret-token"
    const hash1 = hashToken(token)
    const hash2 = hashToken(token)
    expect(hash1).toBe(hash2)
  })

  it("hash is different from input", () => {
    const token = generateToken()
    const hash = hashToken(token)
    expect(hash).not.toBe(token)
  })

  it("different inputs produce different hashes", () => {
    const hash1 = hashToken("token-a")
    const hash2 = hashToken("token-b")
    expect(hash1).not.toBe(hash2)
  })
})
