/**
 * Mail sandbox guard — PURE mode-resolution and recipient-rewriting logic.
 *
 * This module contains NO I/O (no nodemailer, no Supabase, no process.env
 * access at module scope). All environment input is passed in explicitly so
 * every branch is unit-testable. The actual send lives in `./send.ts`, which
 * wraps `mailTransport` and consumes the plan produced here.
 *
 * Purpose: during end-to-end testing we must NEVER deliver mail to the real
 * (legacy-imported) drivers. The guard enforces a fail-safe default — without
 * an explicit `MAIL_MODE=live`, mail is either redirected to a test inbox or
 * only logged. See docs/guides/mail-testing.md.
 */

export type MailMode = "live" | "redirect" | "log"

/** The subset of environment variables the guard reads. */
export interface GuardEnv {
  MAIL_MODE?: string
  MAIL_REDIRECT_TO?: string
  MAIL_ALLOWLIST?: string
}

/** Recipient fields as accepted by nodemailer (single or multiple). */
export interface RecipientFields {
  to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
}

export interface GuardedMailPlan {
  mode: MailMode
  /** Whether the mail should actually be handed to the transport. */
  send: boolean
  /** Effective recipient fields to pass to nodemailer (only relevant if send). */
  to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  /** All distinct originally-intended recipients (to + cc + bcc). */
  originalRecipients: string[]
  /** Who the mail is actually delivered to (empty in log mode). */
  effectiveRecipients: string[]
  /**
   * Audit label for `mail_log.recipient`. Always LEADS with the original
   * recipient(s), followed by a bracketed mode tag so the effective mode is
   * captured without a schema migration (e.g. "a@old.ch → test@x [redirect]").
   */
  auditLabel: string
  /** Suggested value for `mail_log.status`. */
  logStatus: "sent" | "logged"
}

/**
 * Resolve the effective mail mode.
 *
 * Fail-safe contract: the result is NEVER `live` unless `MAIL_MODE` is
 * explicitly `live`. Anything unset or invalid degrades to `redirect` (when a
 * redirect target exists) or `log`. `redirect` without a target also degrades
 * to `log` — we never send to real recipients by accident.
 */
export function resolveMailMode(env: GuardEnv): MailMode {
  const raw = (env.MAIL_MODE ?? "").trim().toLowerCase()
  const hasRedirectTarget = (env.MAIL_REDIRECT_TO ?? "").trim().length > 0

  if (raw === "live") return "live"
  if (raw === "log") return "log"
  if (raw === "redirect") return hasRedirectTarget ? "redirect" : "log"

  // Unset or invalid value — fail-safe, never live.
  return hasRedirectTarget ? "redirect" : "log"
}

/**
 * Parse a comma-separated allowlist into normalised (trimmed, lower-cased)
 * entries. Entries may be full addresses ("a@b.ch") or domain entries ("@b.ch").
 */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
}

/**
 * Case-insensitive allowlist match. An entry starting with "@" matches any
 * address on that domain; otherwise the whole address must match exactly.
 */
export function matchesAllowlist(email: string, allowlist: string[]): boolean {
  const target = email.trim().toLowerCase()
  if (!target) return false

  for (const entry of allowlist) {
    if (entry.startsWith("@")) {
      if (target.endsWith(entry)) return true
    } else if (target === entry) {
      return true
    }
  }
  return false
}

/** Flatten a single-or-array recipient field into a plain string array. */
function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** De-duplicate case-insensitively while preserving first-seen order/casing. */
function dedupe(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const trimmed = item.trim()
    const key = trimmed.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/**
 * Format a recipient list for human-readable subject/audit text. Up to three
 * are listed in full; beyond that the first is shown with a "+N weitere" count.
 */
export function formatRecipientList(list: string[]): string {
  if (list.length === 0) return "(keine)"
  if (list.length <= 3) return list.join(", ")
  const [first] = list
  return `${first ?? ""} +${list.length - 1} weitere`
}

/**
 * Build the full send plan for a mail given the current environment. Pure.
 */
export function planGuardedMail(
  fields: RecipientFields,
  env: GuardEnv
): GuardedMailPlan {
  const mode = resolveMailMode(env)
  const originalRecipients = dedupe([
    ...toArray(fields.to),
    ...toArray(fields.cc),
    ...toArray(fields.bcc),
  ])

  if (mode === "live") {
    return {
      mode,
      send: true,
      to: fields.to,
      cc: fields.cc,
      bcc: fields.bcc,
      subject: fields.subject,
      originalRecipients,
      effectiveRecipients: originalRecipients,
      auditLabel: formatRecipientList(originalRecipients),
      logStatus: "sent",
    }
  }

  if (mode === "log") {
    return {
      mode,
      send: false,
      to: fields.to,
      cc: fields.cc,
      bcc: fields.bcc,
      subject: fields.subject,
      originalRecipients,
      effectiveRecipients: [],
      auditLabel: `${formatRecipientList(originalRecipients)} [log]`,
      logStatus: "logged",
    }
  }

  // --- redirect mode --------------------------------------------------------
  // resolveMailMode guarantees a non-empty redirect target here.
  const redirectTarget = (env.MAIL_REDIRECT_TO ?? "").trim()
  const allowlist = parseAllowlist(env.MAIL_ALLOWLIST)
  const passthrough = originalRecipients.filter((email) =>
    matchesAllowlist(email, allowlist)
  )
  const redirected = originalRecipients.filter(
    (email) => !matchesAllowlist(email, allowlist)
  )

  // Allowlisted recipients are still delivered; everything else collapses onto
  // the single redirect target. cc/bcc are folded into `to` so no real person
  // is ever cc'd by accident.
  const effectiveTo = dedupe([
    ...passthrough,
    ...(redirected.length > 0 ? [redirectTarget] : []),
  ])

  const subject =
    redirected.length > 0
      ? `[TEST → ${formatRecipientList(redirected)}] ${fields.subject}`
      : fields.subject

  const auditLabel =
    redirected.length > 0
      ? `${formatRecipientList(originalRecipients)} → ${redirectTarget} [redirect]`
      : `${formatRecipientList(originalRecipients)} [allowlist]`

  return {
    mode,
    send: true,
    to: effectiveTo,
    cc: undefined,
    bcc: undefined,
    subject,
    originalRecipients,
    effectiveRecipients: effectiveTo,
    auditLabel,
    logStatus: "sent",
  }
}
