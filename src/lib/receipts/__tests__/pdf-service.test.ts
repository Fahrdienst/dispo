import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks. Everything referenced inside a vi.mock factory must be created via
// vi.hoisted (the factories are hoisted above normal top-level declarations).
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))

interface Result {
  data: unknown
  error: unknown
}

const H = vi.hoisted(() => {
  const state = {
    dbConfig: {} as Record<string, Result>,
    downloadResult: { data: null, error: { message: "no logo" } } as Result,
    uploadResult: { error: null } as { error: unknown },
  }
  const uploadSpy = vi.fn()
  const mockRenderToBuffer = vi.fn(async () => Buffer.from("pdf-bytes"))

  /** A chainable, awaitable query stub that always resolves to `result`. */
  function makeQuery(result: Result) {
    const q: Record<string, unknown> = {}
    for (const m of ["select", "eq", "order", "limit", "update", "insert"]) {
      q[m] = () => q
    }
    q.single = () => Promise.resolve(result)
    q.then = (resolve: (value: unknown) => unknown) => resolve(result)
    return q
  }

  return { state, uploadSpy, mockRenderToBuffer, makeQuery }
})

// Provide the @react-pdf primitives used by pdf-document.tsx as plain string
// element types (that is exactly how react-pdf models them at runtime).
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: H.mockRenderToBuffer,
  Document: "DOCUMENT",
  Page: "PAGE",
  View: "VIEW",
  Text: "TEXT",
  Image: "IMAGE",
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => H.makeQuery(H.state.dbConfig[table] as Result)),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(() => Promise.resolve(H.state.downloadResult)),
        upload: vi.fn((path: string, body: unknown, opts: unknown) => {
          H.uploadSpy(path, body, opts)
          return Promise.resolve(H.state.uploadResult)
        }),
      })),
    },
  })),
}))

// Import after mocks
import { generateAndStoreReceiptPdf } from "@/lib/receipts/pdf-service"

const RECEIPT_ID = "11111111-1111-4111-8111-111111111111"

const HAPPY_RECEIPT = {
  id: RECEIPT_ID,
  receipt_number: "Q-2026-00042",
  recipient_name: "Max Muster",
  recipient_address: "Bahnhofstrasse 1\n8600 Dübendorf",
  period_from: "2026-07-01",
  period_to: "2026-07-31",
  total_amount: 65,
  currency: "CHF",
  issued_at: "2026-07-16T10:00:00.000Z",
  issued_by: "22222222-2222-4222-8222-222222222222",
  status: "issued",
  cancelled_reason: null,
  pdf_path: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  H.state.dbConfig = {
    receipts: { data: HAPPY_RECEIPT, error: null },
    receipt_items: {
      data: [
        {
          ride_date: "2026-07-05",
          description: "Dübendorf → USZ (Hinfahrt)",
          distance_km: 12.5,
          amount: 25,
        },
        {
          ride_date: "2026-07-06",
          description: "Dübendorf → USZ (Rückfahrt)",
          distance_km: 12.5,
          amount: 40,
        },
      ],
      error: null,
    },
    organization_settings: {
      data: {
        org_name: "Fahrdienst Verein",
        org_street: "Dorfstrasse 3",
        org_postal_code: "8600",
        org_city: "Dübendorf",
        org_phone: "044 111 22 33",
        org_email: "info@example.ch",
        logo_url: null,
      },
      error: null,
    },
    profiles: { data: { display_name: "Olga Operator" }, error: null },
  }
  H.state.downloadResult = { data: null, error: { message: "no logo" } }
  H.state.uploadResult = { error: null }
})

describe("generateAndStoreReceiptPdf", () => {
  it("renders, uploads to <year>/<number>.pdf and returns the path", async () => {
    const result = await generateAndStoreReceiptPdf(RECEIPT_ID)

    expect(result).toEqual({ pdfPath: "2026/Q-2026-00042.pdf" })
    expect(H.mockRenderToBuffer).toHaveBeenCalledOnce()
    expect(H.uploadSpy).toHaveBeenCalledWith(
      "2026/Q-2026-00042.pdf",
      expect.any(Buffer),
      { upsert: true, contentType: "application/pdf" }
    )
  })

  it("derives the storage path without any PII (SEC-M14-012)", async () => {
    const { pdfPath } = await generateAndStoreReceiptPdf(RECEIPT_ID)
    // Only year + receipt number, never the recipient name.
    expect(pdfPath).toBe("2026/Q-2026-00042.pdf")
    expect(pdfPath).not.toContain("Muster")
  })

  it("throws when the receipt cannot be loaded", async () => {
    H.state.dbConfig.receipts = { data: null, error: { message: "not found" } }
    await expect(generateAndStoreReceiptPdf(RECEIPT_ID)).rejects.toThrow(
      /nicht geladen werden/
    )
    expect(H.uploadSpy).not.toHaveBeenCalled()
  })

  it("throws when the storage upload fails (receipt stays valid, path unset)", async () => {
    H.state.uploadResult = { error: { message: "storage down" } }
    await expect(generateAndStoreReceiptPdf(RECEIPT_ID)).rejects.toThrow(
      /PDF-Upload fehlgeschlagen/
    )
  })
})
