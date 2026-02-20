import { z } from "zod"

const emptyToNull = (v: string) => (v === "" ? null : v)

/**
 * Default buffer (minutes) between appointment_end_time and return_pickup_time.
 * Used in the UI to pre-fill the return pickup time suggestion.
 */
export const DEFAULT_RETURN_BUFFER_MINUTES = 15

/**
 * Adds minutes to a time string (HH:MM format).
 * Returns null if the result exceeds 23:59.
 */
export function addMinutesToTime(
  time: string,
  minutes: number
): string | null {
  const [h, m] = time.split(":").map(Number)
  if (h === undefined || m === undefined) return null
  const totalMinutes = h * 60 + m + minutes
  if (totalMinutes >= 24 * 60) return null
  const newH = Math.floor(totalMinutes / 60)
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`
}

export const rideSchema = z
  .object({
    patient_id: z.string().uuid("Patient ist erforderlich"),
    destination_id: z.string().uuid("Ziel ist erforderlich"),
    driver_id: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional(),
    date: z.string().min(1, "Datum ist erforderlich"),
    pickup_time: z.string().min(1, "Abholzeit ist erforderlich"),
    direction: z.enum(["outbound", "return", "both"]).default("outbound"),
    // --- New appointment time fields (ADR-008) ---
    appointment_time: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional(),
    appointment_end_time: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional(),
    return_pickup_time: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional(),
    // --- Auto-return flag (not persisted, used by Server Action) ---
    create_return_ride: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    notes: z
      .string()
      .max(1000)
      .transform(emptyToNull)
      .nullable()
      .optional(),
    // --- Price override fields (ADR-010, Issue #60) ---
    price_override: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional()
      .transform((v) => (v ? parseFloat(v) : null)),
    price_override_reason: z
      .string()
      .max(500)
      .transform(emptyToNull)
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Price override requires a reason
    if (data.price_override != null && !data.price_override_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price_override_reason"],
        message:
          "Begruendung ist erforderlich, wenn der Preis manuell ueberschrieben wird",
      })
    }
    // Time order validation (only when fields are set)
    if (data.appointment_time && data.pickup_time) {
      if (data.pickup_time >= data.appointment_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["appointment_time"],
          message: "Terminzeit muss nach der Abholzeit liegen",
        })
      }
    }

    if (data.appointment_time && data.appointment_end_time) {
      if (data.appointment_end_time <= data.appointment_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["appointment_end_time"],
          message: "Terminende muss nach dem Terminbeginn liegen",
        })
      }
    }

    if (data.appointment_end_time && data.return_pickup_time) {
      if (data.return_pickup_time < data.appointment_end_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["return_pickup_time"],
          message:
            "Rueckfahrt-Abholzeit darf nicht vor dem Terminende liegen",
        })
      }
    }

    // If create_return_ride is checked, appointment_end_time is required
    if (data.create_return_ride && !data.appointment_end_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["appointment_end_time"],
        message:
          "Terminende ist erforderlich, wenn eine Heimfahrt angelegt werden soll",
      })
    }
  })

export type RideFormValues = z.infer<typeof rideSchema>
