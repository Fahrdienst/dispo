import { z } from "zod"

/**
 * Maximum length of the base64 screenshot data URL (~2 MB binary ≈ 2.8 MB base64).
 * Rounded up to 3 MB to leave headroom for the data-URL prefix.
 */
const SCREENSHOT_MAX_LENGTH = 3_000_000

/** Only PNG and JPEG data URLs are accepted. */
const SCREENSHOT_DATA_URL_REGEX = /^data:image\/(png|jpeg);base64,/

/** Treat empty strings as absent so optional email/text fields validate cleanly. */
const emptyToNull = (v: string): string | null => (v === "" ? null : v)

/**
 * Validation schema for in-app feedback submissions.
 *
 * Note: `pageUrl` / `userAgent` are best-effort client hints; the server
 * re-derives trustworthy metadata (role, user-agent) itself and never trusts
 * the client for the reporter's role.
 */
export const feedbackSchema = z.object({
  type: z.enum(["bug", "idea", "other"]),
  title: z
    .string()
    .trim()
    .min(3, "Der Titel muss mindestens 3 Zeichen lang sein")
    .max(120, "Der Titel darf höchstens 120 Zeichen lang sein"),
  description: z
    .string()
    .trim()
    .max(4000, "Die Beschreibung darf höchstens 4000 Zeichen lang sein")
    .optional(),
  contactEmail: z
    .string()
    .transform(emptyToNull)
    .nullable()
    .optional()
    .pipe(z.string().email("Ungültige E-Mail-Adresse").nullable().optional()),
  screenshotBase64: z
    .string()
    .regex(SCREENSHOT_DATA_URL_REGEX, "Ungültiges Bildformat (nur PNG oder JPEG)")
    .max(SCREENSHOT_MAX_LENGTH, "Der Screenshot ist zu gross")
    .optional(),
  pageUrl: z.string().max(300).optional(),
  userAgent: z.string().max(300).optional(),
})

export type FeedbackInput = z.infer<typeof feedbackSchema>
export type FeedbackType = FeedbackInput["type"]
