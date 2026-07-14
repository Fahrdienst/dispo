import { escapeHtml } from "@/lib/mail/utils"
import {
  ABSENCE_TYPE_LABELS,
  type AbsenceType,
} from "@/lib/absences/status-machine"

/**
 * Absence decision email (Issue #105).
 *
 * Sent to a driver when staff approve or reject their absence request.
 * German, short, readable without a login. All user-provided values are
 * escaped for XSS safety. Table-based layout with inline CSS for broad
 * email-client compatibility (mirrors the other M11/M12 templates).
 */

export interface AbsenceDecisionEmailData {
  driverName: string
  type: AbsenceType
  /** Raw ISO date (YYYY-MM-DD). */
  startDate: string
  /** Raw ISO date (YYYY-MM-DD). */
  endDate: string
  /** Only 'approved' or 'rejected' reach the mailer. */
  decision: "approved" | "rejected"
  /** Optional dispatch note (free text). */
  note: string | null
}

/** Swiss-German short date: "2026-07-20" -> "20.07.2026". */
function formatDateCH(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

/** Compact range; a single-day absence collapses to one date. */
function formatRange(start: string, end: string): string {
  return start === end
    ? formatDateCH(start)
    : `${formatDateCH(start)} – ${formatDateCH(end)}`
}

export function absenceDecisionEmail(data: AbsenceDecisionEmailData): {
  subject: string
  html: string
} {
  const approved = data.decision === "approved"
  const decisionLabel = approved ? "genehmigt" : "abgelehnt"
  const subject = approved
    ? "Ihre Abwesenheit wurde genehmigt"
    : "Ihre Abwesenheit wurde abgelehnt"

  // Escape every user-controlled value.
  const driverName = escapeHtml(data.driverName)
  const typeLabel = escapeHtml(ABSENCE_TYPE_LABELS[data.type])
  const range = escapeHtml(formatRange(data.startDate, data.endDate))
  const note = data.note ? escapeHtml(data.note) : null

  // Functional colour: green for approved, red for rejected. Always paired
  // with the text label, never colour alone (accessibility).
  const accent = approved ? "#16a34a" : "#dc2626"
  const badgeBg = approved ? "#dcfce7" : "#fee2e2"
  const badgeText = approved ? "#166534" : "#991b1b"

  const noteBlock = note
    ? `<tr>
        <td style="padding:0 32px 8px;">
          <p style="margin:0 0 4px;color:#71717a;font-size:13px;">Anmerkung der Disposition</p>
          <p style="margin:0;padding:12px 16px;background-color:#f4f4f5;border-radius:6px;color:#3f3f46;font-size:14px;line-height:1.5;">${note}</p>
        </td>
      </tr>`
    : ""

  const followUp = approved
    ? "Ihre Abwesenheit ist damit bestätigt. Bereits zugeteilte Fahrten in diesem Zeitraum werden von der Disposition neu vergeben."
    : "Bitte wenden Sie sich bei Rückfragen an die Disposition."

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Dispo Krankentransport</h1>
            </td>
          </tr>

          <!-- Decision banner -->
          <tr>
            <td style="background-color:${accent};padding:12px 32px;">
              <p style="margin:0;color:#ffffff;font-size:15px;font-weight:600;text-align:center;">
                Abwesenheit ${escapeHtml(decisionLabel)}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 16px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:16px;">
                Hallo ${driverName},
              </p>
              <p style="margin:0 0 24px;color:#3f3f46;font-size:14px;line-height:1.5;">
                Ihr Abwesenheitsantrag wurde von der Disposition
                <strong>${escapeHtml(decisionLabel)}</strong>.
              </p>

              <!-- Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:6px;padding:16px;margin-bottom:8px;">
                <tr>
                  <td style="padding:6px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;width:100px;">Typ</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${typeLabel}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Zeitraum</td>
                        <td style="color:#18181b;font-size:14px;font-weight:500;padding:4px 0;">${range}</td>
                      </tr>
                      <tr>
                        <td style="color:#71717a;font-size:13px;padding:4px 0;">Entscheidung</td>
                        <td style="padding:4px 0;">
                          <span style="display:inline-block;background-color:${badgeBg};color:${badgeText};font-size:13px;font-weight:600;padding:2px 10px;border-radius:9999px;">${escapeHtml(decisionLabel.charAt(0).toUpperCase() + decisionLabel.slice(1))}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${noteBlock}

          <!-- Follow-up note -->
          <tr>
            <td style="padding:8px 32px 24px;">
              <p style="margin:0;color:#3f3f46;font-size:14px;line-height:1.5;">
                ${escapeHtml(followUp)}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
                Diese E-Mail wurde automatisch versendet. Bei Fragen wenden Sie sich an die Disposition.
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
