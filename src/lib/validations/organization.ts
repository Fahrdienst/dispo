import { z } from "zod"

const emptyToNull = (v: string) => (v === "" ? null : v)

/**
 * Time-buffer default (minutes), configurable per organization (Issue #128).
 * FormData delivers strings, so coerce to an integer and clamp to a sane
 * range. 0-120 mirrors the CHECK constraint in
 * supabase/migrations/20260329_000001_org_settings_time_buffers.sql.
 */
const bufferMinutes = (fallback: number) =>
  z.coerce
    .number({ invalid_type_error: "Ganzzahl erforderlich" })
    .int("Ganzzahl erforderlich")
    .min(0, "Mindestens 0 Minuten")
    .max(120, "Maximal 120 Minuten")
    .default(fallback)

export const updateOrganizationSchema = z.object({
  org_name: z.string().min(1, "Organisationsname ist erforderlich").max(200),
  org_street: z.string().transform(emptyToNull).nullable().optional(),
  org_postal_code: z
    .string()
    .transform(emptyToNull)
    .nullable()
    .optional()
    .pipe(
      z
        .string()
        .regex(/^\d{4}$/, "PLZ muss 4-stellig sein (CH)")
        .nullable()
        .optional()
    ),
  org_city: z.string().transform(emptyToNull).nullable().optional(),
  org_phone: z.string().transform(emptyToNull).nullable().optional(),
  org_email: z
    .string()
    .transform(emptyToNull)
    .nullable()
    .optional()
    .pipe(z.string().email("Ungültige E-Mail-Adresse").nullable().optional()),
  org_website: z.string().transform(emptyToNull).nullable().optional(),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Ungültiger Farbcode")
    .default("#000000"),
  secondary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Ungültiger Farbcode")
    .default("#0066FF"),
  email_enabled: z
    .string()
    .transform((v) => v === "true")
    .or(z.boolean())
    .default(false),
  sms_enabled: z
    .string()
    .transform((v) => v === "true")
    .or(z.boolean())
    .default(false),
  email_from_name: z.string().max(100).default("Fahrdienst"),
  email_from_address: z
    .string()
    .transform(emptyToNull)
    .nullable()
    .optional()
    .pipe(z.string().email("Ungültige E-Mail-Adresse").nullable().optional()),
  // Zeit-Puffer-Defaults (Issue #128) — Defaults = bisherige Konstanten.
  default_pickup_buffer_minutes: bufferMinutes(5),
  default_boarding_minutes: bufferMinutes(0),
  default_return_buffer_minutes: bufferMinutes(15),
})

export type UpdateOrganizationFormValues = z.infer<
  typeof updateOrganizationSchema
>
