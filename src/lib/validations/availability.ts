import { z } from "zod"

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const
const SLOT_START_TIMES = ["08:00", "10:00", "12:00", "14:00", "16:00"] as const

/** Single slot: a weekday + start time pair */
const slotSchema = z.object({
  day_of_week: z.enum(WEEKDAYS),
  start_time: z.enum(SLOT_START_TIMES),
})

/**
 * Schema for the full weekly availability grid.
 * Input: an array of {day_of_week, start_time} pairs representing active slots.
 * The server action will compute end_time = start_time + 2h.
 */
export const weeklyAvailabilitySchema = z.object({
  driver_id: z.string().uuid("Ungueltige Fahrer-ID"),
  slots: z
    .array(slotSchema)
    .max(25, "Maximal 25 Slots (5 Tage x 5 Zeitfenster)")
    .refine(
      (slots) => {
        const keys = slots.map((s) => `${s.day_of_week}-${s.start_time}`)
        return new Set(keys).size === keys.length
      },
      { message: "Doppelte Slots sind nicht erlaubt" }
    ),
})

export type WeeklyAvailabilityValues = z.infer<typeof weeklyAvailabilitySchema>
export type SlotValue = z.infer<typeof slotSchema>

/** Constants for UI rendering */
export const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
}

export const SLOT_LABELS: Record<(typeof SLOT_START_TIMES)[number], string> = {
  "08:00": "08:00 - 10:00",
  "10:00": "10:00 - 12:00",
  "12:00": "12:00 - 14:00",
  "14:00": "14:00 - 16:00",
  "16:00": "16:00 - 18:00",
}

export { WEEKDAYS, SLOT_START_TIMES }
