/**
 * Shared mail utility functions.
 * Consolidates previously duplicated helpers across mail templates.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
}

const HTML_ESCAPE_REGEX = /[&<>"']/g

/**
 * Escape HTML special characters to prevent XSS in email templates.
 * Covers the OWASP recommended set: & < > " '
 */
export function escapeHtml(str: string): string {
  return str.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] ?? char)
}

const WEEKDAY_NAMES = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
] as const

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "M\u00e4rz",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const

/**
 * Format a date string (YYYY-MM-DD) to German long format.
 * Example: "2026-02-25" -> "Mittwoch, 25. Februar 2026"
 *
 * Parses as local date (T00:00:00) to avoid timezone-shift issues.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  const weekday = WEEKDAY_NAMES[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]
  return `${weekday}, ${date.getDate()}. ${month} ${date.getFullYear()}`
}

/**
 * Format a CHF amount with two decimal places.
 * Example: 65 -> "Fr. 65.00", 12.5 -> "Fr. 12.50"
 */
export function formatCHF(amount: number): string {
  return `Fr. ${amount.toFixed(2)}`
}

/**
 * Format a time string by stripping seconds if present.
 * Example: "14:30:00" -> "14:30", "14:30" -> "14:30"
 */
export function formatTime(timeStr: string): string {
  // HH:MM:SS -> HH:MM, or HH:MM stays HH:MM
  const parts = timeStr.split(":")
  return `${parts[0]}:${parts[1]}`
}
