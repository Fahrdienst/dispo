import { z } from "zod"

export const destinationSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(200),
  type: z.enum(["hospital", "doctor", "therapy", "other"]).default("other"),
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
  department: z
    .string()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(1000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
})

export type DestinationFormValues = z.infer<typeof destinationSchema>
