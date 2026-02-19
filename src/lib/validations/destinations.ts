import { z } from "zod"

const emptyToNull = (v: string) => (v === "" ? null : v)

export const destinationSchema = z.object({
  display_name: z.string().min(1, "Name ist erforderlich").max(200),
  facility_type: z
    .enum(["practice", "hospital", "therapy_center", "day_care", "other"])
    .default("other"),
  contact_first_name: z
    .string()
    .min(1, "Vorname Kontaktperson ist erforderlich")
    .max(100),
  contact_last_name: z
    .string()
    .min(1, "Nachname Kontaktperson ist erforderlich")
    .max(100),
  contact_phone: z
    .string()
    .min(1, "Kontakttelefon ist erforderlich")
    .max(50),
  street: z.string().min(1, "Strasse ist erforderlich").max(200),
  house_number: z.string().min(1, "Hausnummer ist erforderlich").max(20),
  postal_code: z
    .string()
    .min(1, "PLZ ist erforderlich")
    .regex(/^\d{4}$/, "PLZ muss 4-stellig sein (CH)"),
  city: z.string().min(1, "Ort ist erforderlich").max(100),
  department: z
    .string()
    .max(200)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  comment: z
    .string()
    .max(2000)
    .transform(emptyToNull)
    .nullable()
    .optional(),
})

export type DestinationFormValues = z.infer<typeof destinationSchema>
