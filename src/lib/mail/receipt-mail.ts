import { createAdminClient } from "@/lib/supabase/admin"
import { mailTransport } from "@/lib/mail/transport"
import { escapeHtml } from "@/lib/mail/utils"

// Storage bucket holding the immutable receipt PDFs (private).
const RECEIPTS_BUCKET = "receipts"

/**
 * Data required to render the receipt notification e-mail.
 *
 * SEC-M14-004 (Datenminimierung): the mail body deliberately carries ONLY the
 * recipient salutation, the receipt number, the billing period and the sender
 * organisation. It must NEVER contain ride details, destinations, diagnoses or
 * any other health-inferring information — those live exclusively inside the
 * PDF attachment. Keep this interface intentionally narrow.
 */
export interface ReceiptMailData {
  recipientName: string
  receiptNumber: string
  periodFrom: string // YYYY-MM-DD
  periodTo: string // YYYY-MM-DD
  orgName: string
}

/** Format a YYYY-MM-DD date as Swiss "DD.MM.YYYY" without pulling in locale I/O. */
function formatSwissDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  if (!year || !month || !day) return dateStr
  return `${day}.${month}.${year}`
}

/**
 * Render the (data-minimised) receipt e-mail. Pure function — no I/O — so the
 * data-minimisation guarantee is unit-testable.
 *
 * Subject and body contain the receipt number and period only. Both are safe:
 * a number and two dates carry no health context. All user-controlled strings
 * are HTML-escaped (XSS defence, consistent with ADR-013).
 */
export function renderReceiptMail(data: ReceiptMailData): {
  subject: string
  html: string
} {
  const { recipientName, receiptNumber, periodFrom, periodTo, orgName } = data

  const safeName = escapeHtml(recipientName)
  const safeNumber = escapeHtml(receiptNumber)
  const safeOrg = escapeHtml(orgName)
  const period =
    periodFrom === periodTo
      ? formatSwissDate(periodFrom)
      : `${formatSwissDate(periodFrom)} – ${formatSwissDate(periodTo)}`

  const subject = `Ihre Quittung Nr. ${receiptNumber}`

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;padding:32px;">
          <tr>
            <td style="font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px;">Guten Tag ${safeName}</p>
              <p style="margin:0 0 16px;">
                Ihre Quittung Nr. <strong>${safeNumber}</strong> f&uuml;r den Zeitraum
                ${period} finden Sie im Anhang dieser E-Mail (PDF).
              </p>
              <p style="margin:0 0 16px;">Freundliche Gr&uuml;sse<br />${safeOrg}</p>
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#71717a;">
                Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht darauf.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}

export type SendReceiptMailResult =
  | { ok: true; recipient: string }
  | { ok: false; error: string }

/**
 * Send an issued receipt to the patient as a PDF attachment (Issue #151).
 *
 * SEC-M14-004: PDF is attached, NOT linked (no bearer token in the mailbox).
 * SEC-M14-005: no signed Storage URL is created for the mail path at all.
 *
 * Failure semantics: a mail failure is a mail problem, never a receipt problem.
 * This function never throws — every path returns a typed result and writes a
 * metadata-only `mail_log` row (no PDF content / health data, SEC-M14-004 §4).
 *
 * Uses the admin (service-role) client: it runs after a staff-authorised action
 * and must read the private bucket + resolve the patient e-mail.
 */
export async function sendReceiptMail(
  receiptId: string
): Promise<SendReceiptMailResult> {
  const supabase = createAdminClient()

  // 1. Load the issued receipt (snapshot fields + PDF path + linked patient).
  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .select(
      "id, receipt_number, recipient_name, period_from, period_to, status, pdf_path, patient_id"
    )
    .eq("id", receiptId)
    .single()

  if (receiptError || !receipt) {
    await logReceiptMail(supabase, "unknown", "failed", "Beleg nicht gefunden")
    return { ok: false, error: "Beleg nicht gefunden." }
  }

  if (receipt.status === "cancelled") {
    return { ok: false, error: "Stornierte Belege können nicht versendet werden." }
  }

  if (!receipt.pdf_path) {
    return {
      ok: false,
      error: "Für diesen Beleg wurde noch kein PDF erzeugt.",
    }
  }

  // 2. Resolve the recipient e-mail (patients.email only). No patient / no
  //    e-mail => no send (SEC-M14-010: never guess a recipient).
  if (!receipt.patient_id) {
    return { ok: false, error: "Keine E-Mail-Adresse hinterlegt." }
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("email")
    .eq("id", receipt.patient_id)
    .single()

  const recipientEmail = patient?.email ?? null
  if (!recipientEmail) {
    return { ok: false, error: "Keine E-Mail-Adresse hinterlegt." }
  }

  // 3. Download the immutable PDF from the private bucket for attachment.
  const { data: pdfBlob, error: downloadError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .download(receipt.pdf_path)

  if (downloadError || !pdfBlob) {
    await logReceiptMail(
      supabase,
      recipientEmail,
      "failed",
      "PDF-Download fehlgeschlagen"
    )
    return {
      ok: false,
      error: "Das PDF konnte nicht geladen werden. Bitte versuchen Sie es erneut.",
    }
  }

  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

  // 4. Load the sender organisation name (branding for the body).
  const { data: org } = await supabase
    .from("organization_settings")
    .select("org_name")
    .limit(1)
    .single()

  const { subject, html } = renderReceiptMail({
    recipientName: receipt.recipient_name,
    receiptNumber: receipt.receipt_number,
    periodFrom: receipt.period_from,
    periodTo: receipt.period_to,
    orgName: org?.org_name ?? "Fahrdienst",
  })

  // 5. Send with the PDF attached (never a link).
  try {
    await mailTransport.sendMail({
      from: process.env.MAIL_FROM ?? process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      html,
      attachments: [
        {
          filename: `${receipt.receipt_number}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler"
    console.error("[receipt-mail] send failed:", message)
    await logReceiptMail(supabase, recipientEmail, "failed", message)
    return {
      ok: false,
      error: "Die E-Mail konnte nicht versendet werden. Bitte versuchen Sie es erneut.",
    }
  }

  await logReceiptMail(supabase, recipientEmail, "sent", null)
  return { ok: true, recipient: recipientEmail }
}

/**
 * Best-effort mail_log write. Metadata only — recipient / status / template /
 * time. NEVER the PDF content or any health data (SEC-M14-004 §4). ride_id and
 * driver_id are null for receipt mails.
 */
async function logReceiptMail(
  supabase: ReturnType<typeof createAdminClient>,
  recipient: string,
  status: "sent" | "failed",
  error: string | null
): Promise<void> {
  try {
    await supabase.from("mail_log").insert({
      ride_id: null,
      driver_id: null,
      template: "receipt",
      recipient,
      status,
      error,
    })
  } catch {
    // A logging failure must not affect the send flow.
  }
}
