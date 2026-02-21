import { z } from "zod"

export const rejectionSchema = z.object({
  ride_id: z.string().uuid("Ungueltige Fahrt-ID"),
  rejection_reason: z.enum(
    ["schedule_conflict", "too_far", "vehicle_issue", "personal", "other"],
    { errorMap: () => ({ message: "Bitte waehlen Sie einen Ablehnungsgrund" }) }
  ),
  rejection_text: z
    .string()
    .max(200, "Maximal 200 Zeichen")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
})

export type RejectionFormData = z.infer<typeof rejectionSchema>
