import { z } from "zod"

const dayOfWeekEnum = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
])

export const rideSeriesSchema = z
  .object({
    patient_id: z.string().uuid("Patient ist erforderlich"),
    destination_id: z.string().uuid("Ziel ist erforderlich"),
    recurrence_type: z.enum(["daily", "weekly", "biweekly", "monthly"], {
      required_error: "Wiederholungstyp ist erforderlich",
    }),
    days_of_week: z.array(dayOfWeekEnum).default([]),
    pickup_time: z.string().min(1, "Abholzeit ist erforderlich"),
    direction: z.enum(["outbound", "return", "both"]).default("outbound"),
    start_date: z.string().min(1, "Startdatum ist erforderlich"),
    end_date: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    notes: z
      .string()
      .max(1000)
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (
        data.recurrence_type === "weekly" ||
        data.recurrence_type === "biweekly"
      ) {
        return data.days_of_week.length > 0
      }
      return true
    },
    {
      message:
        "Mindestens ein Wochentag muss ausgewaehlt werden",
      path: ["days_of_week"],
    }
  )
  .refine(
    (data) => {
      if (data.end_date && data.start_date) {
        return data.end_date >= data.start_date
      }
      return true
    },
    {
      message: "Enddatum muss nach dem Startdatum liegen",
      path: ["end_date"],
    }
  )

export type RideSeriesFormValues = z.infer<typeof rideSeriesSchema>

export const generateRidesSchema = z
  .object({
    series_id: z.string().uuid("Serie ist erforderlich"),
    from_date: z.string().min(1, "Von-Datum ist erforderlich"),
    to_date: z.string().min(1, "Bis-Datum ist erforderlich"),
  })
  .refine((data) => data.to_date >= data.from_date, {
    message: "Bis-Datum muss nach dem Von-Datum liegen",
    path: ["to_date"],
  })

export type GenerateRidesFormValues = z.infer<typeof generateRidesSchema>
