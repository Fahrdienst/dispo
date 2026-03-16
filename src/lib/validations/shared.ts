import { z } from "zod"

/** Reusable UUID validation schema for ID parameters in Server Actions. */
export const uuidSchema = z.string().uuid("Ungültige ID")
