import { z } from "zod"

export const patientSchema = z.object({
  first_name: z.string().min(1, "Vorname ist erforderlich").max(100),
  last_name: z.string().min(1, "Nachname ist erforderlich").max(100),
  phone: z
    .string()
    .max(50)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  street: z
    .string()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  house_number: z
    .string()
    .max(20)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  postal_code: z
    .string()
    .max(10)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  city: z
    .string()
    .max(100)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  needs_wheelchair: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  needs_stretcher: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  needs_companion: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  notes: z
    .string()
    .max(1000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
})

export type PatientFormValues = z.infer<typeof patientSchema>
