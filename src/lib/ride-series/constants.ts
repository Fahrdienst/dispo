import type { Enums } from "@/lib/types/database"

type RecurrenceType = Enums<"recurrence_type">
type DayOfWeek = Enums<"day_of_week">

/** German display labels for recurrence types. */
export const RECURRENCE_TYPE_LABELS: Record<RecurrenceType, string> = {
  daily: "Taeglich",
  weekly: "Woechentlich",
  biweekly: "Zweiwoechentlich",
  monthly: "Monatlich",
}

/** Short German labels for days of week. */
export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
  saturday: "Sa",
  sunday: "So",
}

/** Ordered list of all days for consistent UI rendering. */
export const ALL_DAYS_OF_WEEK: readonly DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

/** Common weekday subset for quick-select convenience. */
export const WEEKDAYS: readonly DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const
