import { z } from "zod"

/**
 * Driver self-service contact schema (Issue #99).
 *
 * Covers ONLY the six fields a driver may edit about themselves; identity and
 * dispatch-relevant fields (name, vehicle type) are intentionally absent so a
 * driver can never change them through this path. The matching RPC
 * `update_own_driver_contact` also accepts only these six parameters, so a
 * tampered request carrying extra keys (e.g. `is_active`) is ignored end to end.
 *
 * Every field follows the empty→null pattern: an empty input clears the column
 * (stores NULL) rather than an empty string. All messages are in German.
 */

const emptyToNull = (v: unknown): unknown =>
  typeof v === "string" && v.trim() === "" ? null : v

export const driverSelfContactSchema = z.object({
  phone: z.preprocess(
    emptyToNull,
    z.string().max(50, "Telefonnummer ist zu lang").nullable()
  ),
  email: z.preprocess(
    emptyToNull,
    z
      .string()
      .email("Ungültige E-Mail-Adresse")
      .max(255, "E-Mail-Adresse ist zu lang")
      .nullable()
  ),
  street: z.preprocess(
    emptyToNull,
    z.string().max(200, "Strasse ist zu lang").nullable()
  ),
  house_number: z.preprocess(
    emptyToNull,
    z.string().max(20, "Hausnummer ist zu lang").nullable()
  ),
  postal_code: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}$/, "PLZ muss 4-stellig sein (CH)")
      .nullable()
  ),
  city: z.preprocess(
    emptyToNull,
    z.string().max(100, "Ort ist zu lang").nullable()
  ),
})

export type DriverSelfContactValues = z.infer<typeof driverSelfContactSchema>
