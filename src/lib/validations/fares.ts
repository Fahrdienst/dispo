import { z } from "zod"

const emptyToNull = (v: string) => (v === "" ? null : v)

export const fareVersionSchema = z
  .object({
    name: z.string().min(1, "Name ist erforderlich").max(100),
    valid_from: z.string().min(1, "Gueltig ab ist erforderlich"),
    valid_to: z
      .string()
      .transform(emptyToNull)
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.valid_to && data.valid_from && data.valid_to <= data.valid_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gueltig bis muss nach Gueltig ab liegen",
        path: ["valid_to"],
      })
    }
  })

export type FareVersionFormValues = z.infer<typeof fareVersionSchema>

export const fareRuleSchema = z.object({
  from_zone_id: z.string().uuid("Von-Zone ist erforderlich"),
  to_zone_id: z.string().uuid("Nach-Zone ist erforderlich"),
  base_price: z
    .string()
    .min(1, "Grundpreis ist erforderlich")
    .transform((v) => parseFloat(v))
    .refine((v) => !isNaN(v) && v >= 0, "Grundpreis muss >= 0 sein"),
  price_per_km: z
    .string()
    .transform((v) => (v === "" ? 0 : parseFloat(v)))
    .refine((v) => !isNaN(v) && v >= 0, "Kilometerpreis muss >= 0 sein"),
})

export type FareRuleFormValues = z.infer<typeof fareRuleSchema>
