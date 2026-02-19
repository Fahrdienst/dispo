import { z } from "zod"

export const driverSchema = z.object({
  first_name: z.string().min(1, "Vorname ist erforderlich").max(100),
  last_name: z.string().min(1, "Nachname ist erforderlich").max(100),
  phone: z
    .string()
    .max(50)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  vehicle_type: z.enum(["standard", "wheelchair", "stretcher"]).default("standard"),
  notes: z
    .string()
    .max(1000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
})

export type DriverFormValues = z.infer<typeof driverSchema>
