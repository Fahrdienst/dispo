import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

interface Result {
  data: unknown
  error: unknown
}

const H = vi.hoisted(() => {
  const state = {
    // receipt head keyed by id, so each loaded receipt is distinct.
    receiptsById: {} as Record<string, Result>,
    items: { data: [], error: null } as Result,
    org: { data: null, error: null } as Result,
    profile: { data: { display_name: "Op" }, error: null } as Result,
  }
  const capturedArgs: unknown[] = []
  const mockRenderToBuffer = vi.fn((element: unknown) => {
    capturedArgs.push(element)
    return Promise.resolve(Buffer.from("pdf-bytes"))
  })
  return { state, capturedArgs, mockRenderToBuffer }
})

vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: H.mockRenderToBuffer,
  Document: "DOCUMENT",
  Page: "PAGE",
  View: "VIEW",
  Text: "TEXT",
  Image: "IMAGE",
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}))

vi.mock("@/lib/supabase/admin", () => {
  /** Query stub for a specific table that resolves to the given result set. */
  function tableQuery(table: string) {
    let capturedId: string | null = null
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.eq = (col: string, val: string) => {
      if (col === "id") capturedId = val
      return q
    }
    q.order = () => Promise.resolve(H.state.items)
    q.limit = () => q
    q.single = () => {
      if (table === "receipts") {
        return Promise.resolve(
          H.state.receiptsById[capturedId ?? ""] ?? {
            data: null,
            error: { message: "not found" },
          }
        )
      }
      if (table === "organization_settings") return Promise.resolve(H.state.org)
      if (table === "profiles") return Promise.resolve(H.state.profile)
      return Promise.resolve({ data: null, error: null })
    }
    return q
  }
  return {
    createAdminClient: vi.fn(() => ({
      from: vi.fn((table: string) => tableQuery(table)),
      storage: {
        from: vi.fn(() => ({
          download: vi.fn(() =>
            Promise.resolve({ data: null, error: { message: "no logo" } })
          ),
        })),
      },
    })),
  }
})

import { renderBatchReceiptPdf } from "@/lib/receipts/batch-pdf-service"

function receiptHead(id: string, number: string): Result {
  return {
    data: {
      id,
      receipt_number: number,
      recipient_name: "Max Muster",
      recipient_address: "Bahnhofstrasse 1\n8600 Dübendorf",
      period_from: "2026-07-01",
      period_to: "2026-07-31",
      total_amount: 42,
      currency: "CHF",
      issued_at: "2026-07-16T10:00:00.000Z",
      issued_by: "op-1",
      status: "issued",
      cancelled_reason: null,
      pdf_path: null,
    },
    error: null,
  }
}

/** Read the pages of the captured BatchReceiptDocument element. */
function capturedPages(): Array<{ props: { data: { receiptNumber: string } } }> {
  const doc = H.capturedArgs[H.capturedArgs.length - 1] as {
    props: { children: unknown }
  }
  const children = doc.props.children
  return (Array.isArray(children) ? children : [children]) as Array<{
    props: { data: { receiptNumber: string } }
  }>
}

beforeEach(() => {
  vi.clearAllMocks()
  H.capturedArgs.length = 0
  H.state.receiptsById = {
    "id-1": receiptHead("id-1", "Q-2026-00001"),
    "id-2": receiptHead("id-2", "Q-2026-00002"),
    "id-3": receiptHead("id-3", "Q-2026-00003"),
  }
  H.state.items = { data: [], error: null }
  H.state.org = { data: null, error: null }
})

describe("renderBatchReceiptPdf", () => {
  it("renders one page per receipt in a single document", async () => {
    const { buffer, count } = await renderBatchReceiptPdf(["id-1", "id-2", "id-3"])

    expect(count).toBe(3)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(H.mockRenderToBuffer).toHaveBeenCalledOnce()
    expect(capturedPages()).toHaveLength(3)
  })

  it("sorts pages by receipt number regardless of input order", async () => {
    await renderBatchReceiptPdf(["id-3", "id-1", "id-2"])
    const numbers = capturedPages().map((p) => p.props.data.receiptNumber)
    expect(numbers).toEqual(["Q-2026-00001", "Q-2026-00002", "Q-2026-00003"])
  })

  it("skips receipts that cannot be loaded but renders the rest", async () => {
    const { count } = await renderBatchReceiptPdf(["id-1", "missing", "id-2"])
    expect(count).toBe(2)
    expect(capturedPages()).toHaveLength(2)
  })

  it("throws when no receipt id is given", async () => {
    await expect(renderBatchReceiptPdf([])).rejects.toThrow(/Keine Belege/)
  })

  it("throws when not a single receipt could be loaded", async () => {
    await expect(renderBatchReceiptPdf(["missing"])).rejects.toThrow(
      /Kein Beleg konnte/
    )
    expect(H.mockRenderToBuffer).not.toHaveBeenCalled()
  })
})
