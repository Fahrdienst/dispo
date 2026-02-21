import { z } from "zod"

const emptyToNull = (v: string) => (v === "" ? null : v)

export const patientSchema = z.object({
  first_name: z.string().min(1, "Vorname ist erforderlich").max(100),
  last_name: z.string().min(1, "Nachname ist erforderlich").max(100),
  phone: z
    .string()
    .max(50)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  street: z.string().min(1, "Strasse ist erforderlich").max(200),
  house_number: z.string().min(1, "Hausnummer ist erforderlich").max(20),
  postal_code: z
    .string()
    .min(1, "PLZ ist erforderlich")
    .regex(/^\d{4}$/, "PLZ muss 4-stellig sein (CH)"),
  city: z.string().min(1, "Ort ist erforderlich").max(100),
  emergency_contact_name: z
    .string()
    .max(200)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  emergency_contact_phone: z
    .string()
    .max(50)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  comment: z
    .string()
    .max(2000)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  impairments: z
    .array(z.enum(["rollator", "wheelchair", "stretcher", "companion"]))
    .default([]),
  notes: z
    .string()
    .max(1000)
    .transform(emptyToNull)
    .nullable()
    .optional(),
})

export type PatientFormValues = z.infer<typeof patientSchema>

/** Minimal schema for inline patient creation (no impairments, no emergency contact) */
export const patientInlineSchema = z.object({
  first_name: z.string().min(1, "Vorname ist erforderlich").max(100),
  last_name: z.string().min(1, "Nachname ist erforderlich").max(100),
  phone: z
    .string()
    .max(50)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  street: z.string().min(1, "Strasse ist erforderlich").max(200),
  house_number: z.string().min(1, "Hausnummer ist erforderlich").max(20),
  postal_code: z
    .string()
    .min(1, "PLZ ist erforderlich")
    .regex(/^\d{4}$/, "PLZ muss 4-stellig sein (CH)"),
  city: z.string().min(1, "Ort ist erforderlich").max(100),
})

export type PatientInlineFormValues = z.infer<typeof patientInlineSchema>
