import type Mail from "nodemailer/lib/mailer"
import { mailTransport } from "@/lib/mail/transport"
import { planGuardedMail, type MailMode } from "@/lib/mail/guard"

/**
 * Central, guarded mail entry point. EVERY outgoing mail must go through this
 * wrapper — `mailTransport` is intentionally not used directly by senders any
 * more, so no future sender can bypass the sandbox guard.
 *
 * The mode logic lives in the pure `./guard` module; this file only performs
 * the side effects (transport send + console logging) based on the plan.
 */

export interface GuardedMailOptions {
  from?: string
  to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: Mail.Options["attachments"]
  replyTo?: string
  /**
   * Optional template label. Used ONLY for the log-mode console line so the
   * operator can tell which mail was suppressed. Never handed to nodemailer.
   */
  template?: string
}

export interface GuardedMailResult {
  mode: MailMode
  /** false only in `log` mode (nothing was handed to the transport). */
  sent: boolean
  originalRecipients: string[]
  effectiveRecipients: string[]
  /** Store in `mail_log.recipient` — leads with the original recipient(s). */
  auditLabel: string
  /** Store in `mail_log.status`. */
  logStatus: "sent" | "logged"
}

/**
 * Send a mail through the sandbox guard.
 *
 * - `live`:     delivered normally.
 * - `redirect`: delivered to MAIL_REDIRECT_TO (allowlisted recipients still get
 *               the real mail); subject is prefixed with the original audience.
 * - `log`:      not sent at all; a metadata-only console line is emitted (no
 *               HTML body / PII) and the caller writes a `mail_log` row.
 *
 * Throws only if the underlying transport throws in live/redirect mode, so
 * existing fire-and-forget try/catch semantics in the senders are preserved.
 */
export async function sendGuardedMail(
  options: GuardedMailOptions
): Promise<GuardedMailResult> {
  const { template, to, cc, bcc, subject, ...rest } = options

  const plan = planGuardedMail(
    { to, cc, bcc, subject },
    {
      MAIL_MODE: process.env.MAIL_MODE,
      MAIL_REDIRECT_TO: process.env.MAIL_REDIRECT_TO,
      MAIL_ALLOWLIST: process.env.MAIL_ALLOWLIST,
    }
  )

  if (plan.send) {
    await mailTransport.sendMail({
      ...rest,
      to: plan.to,
      cc: plan.cc,
      bcc: plan.bcc,
      subject: plan.subject,
    })
  } else {
    // log mode: metadata only. Deliberately NO html/text body (may carry PII).
    console.info(
      `[mail:guard] MAIL_MODE=log — send suppressed. ` +
        `template=${template ?? "?"} ` +
        `recipients=${plan.originalRecipients.join(", ") || "(none)"} ` +
        `subject=${JSON.stringify(plan.subject)}`
    )
  }

  return {
    mode: plan.mode,
    sent: plan.send,
    originalRecipients: plan.originalRecipients,
    effectiveRecipients: plan.effectiveRecipients,
    auditLabel: plan.auditLabel,
    logStatus: plan.logStatus,
  }
}
