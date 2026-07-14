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
  email: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().email("Ungueltige E-Mail-Adresse").max(255).nullable().optional()
  ),
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

// Driver self-service contact update (M12, Issue #92/#94).
// Maps 1:1 to the update_own_driver_contact() RPC parameters. All fields are
// optional here (empty -> null) because a driver edits their own contact data
// incrementally; the admin-facing driverSchema above keeps its stricter rules.
export const driverContactSchema = z.object({
  phone: z
    .string()
    .max(50)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  email: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().email("Ungueltige E-Mail-Adresse").max(255).nullable().optional()
  ),
  street: z
    .string()
    .max(200)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  house_number: z
    .string()
    .max(20)
    .transform(emptyToNull)
    .nullable()
    .optional(),
  postal_code: z.preprocess(
    (val) => (val === "" ? null : val),
    z
      .string()
      .regex(/^\d{4}$/, "PLZ muss 4-stellig sein (CH)")
      .nullable()
      .optional()
  ),
  city: z
    .string()
    .max(100)
    .transform(emptyToNull)
    .nullable()
    .optional(),
})

export type DriverContactFormValues = z.infer<typeof driverContactSchema>
