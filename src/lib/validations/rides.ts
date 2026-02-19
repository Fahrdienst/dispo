import { z } from "zod"

export const rideSchema = z.object({
  patient_id: z.string().uuid("Patient ist erforderlich"),
  destination_id: z.string().uuid("Ziel ist erforderlich"),
  driver_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  date: z.string().min(1, "Datum ist erforderlich"),
  pickup_time: z.string().min(1, "Abholzeit ist erforderlich"),
  direction: z.enum(["outbound", "return", "both"]).default("outbound"),
  notes: z
    .string()
    .max(1000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
})

export type RideFormValues = z.infer<typeof rideSchema>
