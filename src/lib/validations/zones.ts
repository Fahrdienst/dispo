import { z } from "zod"

const emptyToNull = (v: string) => (v === "" ? null : v)

export const zoneSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
  description: z
    .string()
    .max(500)
    .transform(emptyToNull)
    .nullable()
    .optional(),
})

export type ZoneFormValues = z.infer<typeof zoneSchema>

export const zonePostalCodeSchema = z.object({
  postal_code: z
    .string()
    .min(1, "PLZ ist erforderlich")
    .regex(/^\d{4}$/, "PLZ muss 4-stellig sein (CH)"),
})

export type ZonePostalCodeFormValues = z.infer<typeof zonePostalCodeSchema>
