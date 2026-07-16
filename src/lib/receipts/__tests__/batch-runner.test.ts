import { describe, it, expect, vi } from "vitest"
import { runReceiptBatch, type BatchRunItem } from "@/lib/receipts/batch-runner"

const ITEM_A: BatchRunItem = {
  patientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  patientName: "Anna Muster",
  rideIds: ["r1", "r2"],
  hasEmail: true,
}
const ITEM_B: BatchRunItem = {
  patientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  patientName: "Bruno Beispiel",
  rideIds: ["r3"],
  hasEmail: false,
}

/** A default `issue` that returns a deterministic receipt per patient. */
function issueOk() {
  return vi.fn(async (patientId: string) => ({
    id: `receipt-${patientId}`,
    receipt_number: `Q-2026-${patientId.slice(0, 5)}`,
  }))
}

describe("runReceiptBatch", () => {
  it("issues one receipt per patient and reports all successes", async () => {
    const generatePdf = vi.fn(async () => {})
    const result = await runReceiptBatch([ITEM_A, ITEM_B], {
      issue: issueOk(),
      generatePdf,
    })

    expect(result.issuedCount).toBe(2)
    expect(result.failedCount).toBe(0)
    expect(result.receiptIds).toHaveLength(2)
    expect(generatePdf).toHaveBeenCalledTimes(2)
    expect(result.outcomes.every((o) => o.status === "issued")).toBe(true)
    expect(result.outcomes.every((o) => o.pdfGenerated)).toBe(true)
  })

  it("isolates a single patient failure and continues (partial result)", async () => {
    const issue = vi
      .fn()
      .mockRejectedValueOnce(new Error("bereits Teil einer aktiven Quittung"))
      .mockResolvedValueOnce({ id: "receipt-b", receipt_number: "Q-2026-00002" })

    const result = await runReceiptBatch([ITEM_A, ITEM_B], {
      issue,
      generatePdf: vi.fn(async () => {}),
    })

    expect(result.issuedCount).toBe(1)
    expect(result.failedCount).toBe(1)
    expect(result.receiptIds).toEqual(["receipt-b"])

    const [a, b] = result.outcomes
    expect(a?.status).toBe("failed")
    expect(a?.error).toMatch(/aktiven Quittung/)
    expect(a?.receiptId).toBeNull()
    expect(b?.status).toBe("issued")
  })

  it("treats a PDF failure as non-blocking (receipt stays issued)", async () => {
    const result = await runReceiptBatch([ITEM_A], {
      issue: issueOk(),
      generatePdf: vi.fn(async () => {
        throw new Error("storage down")
      }),
    })

    const outcome = result.outcomes[0]
    expect(result.issuedCount).toBe(1)
    expect(outcome?.status).toBe("issued")
    expect(outcome?.pdfGenerated).toBe(false)
    // The receipt id is still collected for the collective PDF.
    expect(result.receiptIds).toHaveLength(1)
  })

  it("skips a patient with no billable rides", async () => {
    const issue = issueOk()
    const result = await runReceiptBatch(
      [{ ...ITEM_A, rideIds: [] }],
      { issue, generatePdf: vi.fn(async () => {}) }
    )

    expect(issue).not.toHaveBeenCalled()
    expect(result.issuedCount).toBe(0)
    expect(result.failedCount).toBe(1)
    expect(result.outcomes[0]?.error).toMatch(/Keine quittierbaren Fahrten/)
  })

  it("does not send mail when no sendEmail dep is provided", async () => {
    const result = await runReceiptBatch([ITEM_A], {
      issue: issueOk(),
      generatePdf: vi.fn(async () => {}),
    })
    expect(result.outcomes[0]?.email).toBe("skipped")
  })

  it("sends mail to patients with an address and marks others 'no_email'", async () => {
    const sendEmail = vi.fn(async () => ({ ok: true }))
    const result = await runReceiptBatch([ITEM_A, ITEM_B], {
      issue: issueOk(),
      generatePdf: vi.fn(async () => {}),
      sendEmail,
    })

    // ITEM_A has e-mail, ITEM_B does not.
    expect(result.outcomes[0]?.email).toBe("sent")
    expect(result.outcomes[1]?.email).toBe("no_email")
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it("reports a failed mail without failing the receipt", async () => {
    const result = await runReceiptBatch([ITEM_A], {
      issue: issueOk(),
      generatePdf: vi.fn(async () => {}),
      sendEmail: vi.fn(async () => ({ ok: false, error: "SMTP down" })),
    })

    const outcome = result.outcomes[0]
    expect(outcome?.status).toBe("issued")
    expect(outcome?.email).toBe("failed")
    expect(outcome?.error).toBe("SMTP down")
  })

  it("does not attempt mail when the PDF is missing", async () => {
    const sendEmail = vi.fn(async () => ({ ok: true }))
    const result = await runReceiptBatch([ITEM_A], {
      issue: issueOk(),
      generatePdf: vi.fn(async () => {
        throw new Error("no pdf")
      }),
      sendEmail,
    })

    expect(sendEmail).not.toHaveBeenCalled()
    expect(result.outcomes[0]?.email).toBe("failed")
    expect(result.outcomes[0]?.error).toMatch(/Kein PDF/)
  })
})
