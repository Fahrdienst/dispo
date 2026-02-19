import { z } from "zod"

export const createUserSchema = z
  .object({
    email: z
      .string()
      .min(1, "E-Mail ist erforderlich")
      .email("Ungültige E-Mail-Adresse")
      .max(254)
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
      .max(72, "Passwort darf maximal 72 Zeichen lang sein"),
    display_name: z
      .string()
      .min(1, "Anzeigename ist erforderlich")
      .max(100)
      .trim(),
    role: z.enum(["admin", "operator", "driver"]),
    driver_id: z
      .string()
      .uuid("Ungültige Fahrer-ID")
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.role === "driver") return !!data.driver_id
      return true
    },
    {
      message: "Fahrer muss ausgewählt werden",
      path: ["driver_id"],
    }
  )
  .refine(
    (data) => {
      if (data.role !== "driver") return !data.driver_id
      return true
    },
    {
      message: "Fahrer darf nur bei Rolle 'Fahrer' gesetzt werden",
      path: ["driver_id"],
    }
  )

export const updateUserSchema = z
  .object({
    display_name: z
      .string()
      .min(1, "Anzeigename ist erforderlich")
      .max(100)
      .trim(),
    role: z.enum(["admin", "operator", "driver"]),
    driver_id: z
      .string()
      .uuid("Ungültige Fahrer-ID")
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.role === "driver") return !!data.driver_id
      return true
    },
    {
      message: "Fahrer muss ausgewählt werden",
      path: ["driver_id"],
    }
  )
  .refine(
    (data) => {
      if (data.role !== "driver") return !data.driver_id
      return true
    },
    {
      message: "Fahrer darf nur bei Rolle 'Fahrer' gesetzt werden",
      path: ["driver_id"],
    }
  )

export type CreateUserFormValues = z.infer<typeof createUserSchema>
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>
