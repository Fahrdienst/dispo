import { z } from "zod"

export const communicationLogSchema = z.object({
  ride_id: z.string().uuid(),
  message: z
    .string()
    .min(1, "Nachricht darf nicht leer sein")
    .max(2000, "Nachricht zu lang (max. 2000 Zeichen)"),
})
