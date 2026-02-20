import { z } from "zod"

const emptyToNull = (v: string) => (v === "" ? null : v)

export const driverSchema = z.object({
  first_name: z.string().min(1, "Vorname ist erforderlich").max(100),
  last_name: z.string().min(1, "Nachname ist erforderlich").max(100),
  phone: z
    .string()
    .max(50)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  vehicle_type: z.enum(["standard", "wheelchair", "stretcher"]).default("standard"),
  // Adresse -- erforderlich im Zod, DB erlaubt NULL fuer Altdaten
  street: z.string().min(1, "Strasse ist erforderlich").max(200),
  house_number: z.string().min(1, "Hausnummer ist erforderlich").max(20),
  postal_code: z
    .string()
    .min(1, "PLZ ist erforderlich")
    .regex(/^\d{4}$/, "PLZ muss 4-stellig sein (CH)"),
  city: z.string().min(1, "Ort ist erforderlich").max(100),
  // Fahrzeug / Fahrausweis -- optional
  vehicle: z
    .string()
    .max(200)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  driving_license: z
    .string()
    .max(100)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  // Notfallkontakt -- optional
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
  notes: z
    .string()
    .max(1000)
    .transform(emptyToNull)
    .nullable()
    .optional(),
})

export type DriverFormValues = z.infer<typeof driverSchema>
