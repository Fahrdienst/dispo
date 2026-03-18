import { z } from "zod"

export const passwordSchema = z
  .string()
  .min(12, "Passwort muss mindestens 12 Zeichen lang sein")
  .max(72, "Passwort darf maximal 72 Zeichen lang sein")
  .regex(/[A-Z]/, "Mindestens ein Grossbuchstabe")
  .regex(/[a-z]/, "Mindestens ein Kleinbuchstabe")
  .regex(/[0-9]/, "Mindestens eine Zahl")

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "E-Mail ist erforderlich")
    .email("Ungültige E-Mail-Adresse")
    .trim()
    .toLowerCase(),
})

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwort-Bestätigung stimmt nicht überein",
    path: ["confirmPassword"],
  })

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
