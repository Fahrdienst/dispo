import { z } from "zod"

/**
 * Driver absence-request validation (Issue #102).
 *
 * Mirrors the `request_absence` RPC signature (type, start_date, end_date,
 * reason). The driver identity is NEVER part of this schema — it is derived
 * server-side from the session, so a tampered request cannot file an absence
 * for someone else.
 *
 * DSGVO / data minimisation: `reason` is always optional. In particular, a
 * `sick` absence must NEVER require free-text (it could leak health data). The
 * UI additionally shows a hint discouraging health details. See #102 security
 * review.
 *
 * All messages are in German.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const emptyToNull = (v: unknown): unknown =>
  typeof v === "string" && v.trim() === "" ? null : v

export const absenceRequestSchema = z
  .object({
    type: z.enum(["vacation", "sick", "training", "other"], {
      errorMap: () => ({ message: "Bitte einen Typ auswählen" }),
    }),
    start_date: z
      .string({ required_error: "Startdatum ist erforderlich" })
      .regex(ISO_DATE, "Ungültiges Startdatum"),
    end_date: z
      .string({ required_error: "Enddatum ist erforderlich" })
      .regex(ISO_DATE, "Ungültiges Enddatum"),
    reason: z.preprocess(
      emptyToNull,
      z
        .string()
        .max(500, "Begründung ist zu lang (max. 500 Zeichen)")
        .nullable()
    ),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "Das Enddatum darf nicht vor dem Startdatum liegen",
    path: ["end_date"],
  })

export type AbsenceRequestValues = z.infer<typeof absenceRequestSchema>

/**
 * Staff decision validation (Issue #103).
 *
 * Only `approved` or `rejected` are accepted here — `cancelled`/`requested`
 * are never valid decisions (the DB RPC enforces the same). The note is
 * optional free text (e.g. a rejection reason). The absence id is a UUID; the
 * deciding staff identity is derived server-side (auth.uid()), never sent by
 * the client.
 */
export const absenceDecisionSchema = z.object({
  absence_id: z.string().uuid("Ungültige Antrags-ID"),
  decision: z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "Ungültige Entscheidung" }),
  }),
  note: z.preprocess(
    emptyToNull,
    z.string().max(500, "Anmerkung ist zu lang (max. 500 Zeichen)").nullable()
  ),
})

export type AbsenceDecisionValues = z.infer<typeof absenceDecisionSchema>
