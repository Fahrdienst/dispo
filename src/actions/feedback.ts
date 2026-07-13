"use server"

import { randomUUID } from "crypto"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth/require-auth"
import { rateLimitFeedback } from "@/lib/security/rate-limit"
import { logAudit } from "@/lib/audit/logger"
import { trackEvent } from "@/lib/telemetry"
import { createGithubIssue } from "@/lib/github/create-issue"
import { feedbackSchema, type FeedbackInput, type FeedbackType } from "@/lib/validations/feedback"
import type { ActionResult } from "@/actions/shared"

// Storage bucket for feedback screenshots (private).
const FEEDBACK_BUCKET = "feedback"
// Signed URLs must outlive the issue so the embedded image keeps rendering.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 // 1 year

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "🐛 Etwas funktioniert nicht",
  idea: "💡 Idee / Verbesserung",
  other: "❓ Sonstiges",
}

const GITHUB_LABELS: Record<FeedbackType, string> = {
  bug: "bug",
  idea: "enhancement",
  other: "question",
}

/**
 * Submit in-app feedback: creates a GitHub issue, optionally attaching an
 * uploaded screenshot from private Supabase Storage.
 *
 * Security notes:
 * - Only authenticated users may submit (`requireAuth()`).
 * - The reporter's role/name/email are re-derived server-side; client-supplied
 *   role is never trusted.
 * - All user-controlled strings are neutralized before embedding in the issue
 *   body so GitHub @mentions and slash-commands cannot be triggered.
 */
export async function submitFeedback(
  input: FeedbackInput
): Promise<ActionResult<{ issueUrl: string }>> {
  const auth = await requireAuth()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const parsed = feedbackSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungültige Eingabe"
    return { success: false, error: firstError }
  }
  const data = parsed.data

  const limit = await rateLimitFeedback(auth.userId)
  if (!limit.success) {
    return {
      success: false,
      error:
        "Sie haben in kurzer Zeit zu viele Rückmeldungen gesendet. Bitte versuchen Sie es später erneut.",
    }
  }

  // Load trusted reporter identity (never trust client role).
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", auth.userId)
    .single()

  // Server-side metadata: prefer the request's own user-agent header.
  const headerList = await headers()
  const serverUserAgent = headerList.get("user-agent") ?? ""
  const userAgent = serverUserAgent || (data.userAgent ?? "")
  const pageUrl = data.pageUrl ?? ""
  const displayName = profile?.display_name ?? "Unbekannter Nutzer"
  const contactEmail = data.contactEmail ?? profile?.email ?? ""

  // Optional screenshot upload — best-effort; failures must not block feedback.
  let screenshotUrl: string | null = null
  if (data.screenshotBase64) {
    try {
      screenshotUrl = await uploadScreenshot(auth.userId, data.screenshotBase64)
    } catch (error) {
      console.error("[feedback] Screenshot upload failed:", {
        userId: auth.userId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const issueTitle = buildIssueTitle(data.type, data.title)
  const issueBody = buildIssueBody({
    type: data.type,
    description: data.description ?? "",
    displayName,
    role: auth.role,
    contactEmail,
    pageUrl,
    userAgent,
    screenshotUrl,
  })
  const labels = ["user-feedback", GITHUB_LABELS[data.type]]

  let issue: { number: number; html_url: string }
  try {
    issue = await createGithubIssue({
      title: issueTitle,
      body: issueBody,
      labels,
    })
  } catch (error) {
    // Log full detail server-side; return a generic, token-free message.
    console.error("[feedback] GitHub issue creation failed:", {
      userId: auth.userId,
      type: data.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error:
        "Ihre Rückmeldung konnte nicht übermittelt werden. Bitte versuchen Sie es später erneut.",
    }
  }

  trackEvent({
    event: "feedback_submitted",
    userId: auth.userId,
    properties: {
      type: data.type,
      issue_number: issue.number,
      has_screenshot: screenshotUrl != null,
    },
  })

  // Audit trail. The audit entity-type enum has no dedicated "feedback" value,
  // so we record it under "organization" with a source marker in metadata.
  logAudit({
    userId: auth.userId,
    userRole: auth.role,
    action: "create",
    entityType: "organization",
    metadata: {
      source: "feedback",
      feedback_type: data.type,
      issue_number: issue.number,
    },
  }).catch(() => {})

  return { success: true, data: { issueUrl: issue.html_url } }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode a base64 image data URL and upload it to the private feedback bucket,
 * returning a long-lived signed URL. Throws on any failure.
 */
async function uploadScreenshot(userId: string, dataUrl: string): Promise<string> {
  const commaIdx = dataUrl.indexOf(",")
  if (commaIdx === -1) {
    throw new Error("Ungültige Bilddaten")
  }

  const meta = dataUrl.slice(0, commaIdx)
  const base64 = dataUrl.slice(commaIdx + 1)
  const mime = meta.includes("image/jpeg") ? "image/jpeg" : "image/png"
  const ext = mime === "image/jpeg" ? "jpg" : "png"
  const buffer = Buffer.from(base64, "base64")

  const admin = createAdminClient()
  const path = `${userId}/${randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from(FEEDBACK_BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(FEEDBACK_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (signedError || !signed?.signedUrl) {
    throw new Error(signedError?.message ?? "Signierte URL konnte nicht erstellt werden")
  }

  return signed.signedUrl
}

/** Build a plain-text issue title (GitHub titles are not markdown). */
function buildIssueTitle(type: FeedbackType, title: string): string {
  const prefix = type === "bug" ? "Bug" : type === "idea" ? "Idee" : "Feedback"
  const cleanTitle = title.replace(/[\r\n]+/g, " ").trim()
  return `[${prefix}] ${cleanTitle}`
}

interface IssueBodyParams {
  type: FeedbackType
  description: string
  displayName: string
  role: string
  contactEmail: string
  pageUrl: string
  userAgent: string
  screenshotUrl: string | null
}

/**
 * Assemble the markdown issue body. All user-controlled values are wrapped in
 * inline code or fenced blocks with `@` and fence markers neutralized, so no
 * GitHub @mention or slash-command can ever be triggered from user input.
 */
function buildIssueBody(params: IssueBodyParams): string {
  const {
    type,
    description,
    displayName,
    role,
    contactEmail,
    pageUrl,
    userAgent,
    screenshotUrl,
  } = params

  const lines: string[] = [
    `**Typ:** ${TYPE_LABELS[type]}`,
    "",
    `- **Von:** ${inlineCode(displayName)} (${inlineCode(role)})`,
    `- **E-Mail:** ${inlineCode(contactEmail || "—")}`,
    `- **Seite:** ${inlineCode(pageUrl || "—")}`,
    `- **Browser:** ${inlineCode(userAgent || "—")}`,
    `- **Gemeldet am:** ${new Date().toISOString()}`,
    "",
    "### Beschreibung",
    "",
    description.trim().length > 0
      ? fencedBlock(description)
      : "_Keine Beschreibung angegeben._",
  ]

  if (screenshotUrl) {
    lines.push("", "### Screenshot", "", `![Screenshot](${screenshotUrl})`)
  }

  lines.push(
    "",
    "---",
    "_Automatisch erstellt über das In-App-Feedback der Fahrdienst-Dispo._"
  )

  return lines.join("\n")
}

/**
 * Wrap a value as inline code, stripping backticks/newlines. GitHub never
 * parses @mentions or references inside inline code.
 */
function inlineCode(value: string): string {
  const cleaned = value.replace(/[`\r\n]+/g, " ").trim()
  return cleaned.length > 0 ? `\`${cleaned}\`` : "`—`"
}

/**
 * Wrap multi-line text in a fenced code block, neutralizing any embedded fence
 * markers so the block can't be broken out of.
 */
function fencedBlock(value: string): string {
  const cleaned = value.replace(/```/g, "ʼʼʼ").replace(/\r/g, "")
  return "```text\n" + cleaned + "\n```"
}
