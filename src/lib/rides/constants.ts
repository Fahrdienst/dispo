import type { Enums } from "@/lib/types/database"

type RideStatus = Enums<"ride_status">
type RideDirection = Enums<"ride_direction">

export const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  unplanned: "Ungeplant",
  planned: "Geplant",
  confirmed: "Bestätigt",
  rejected: "Abgelehnt",
  in_progress: "Unterwegs",
  picked_up: "Abgeholt",
  arrived: "Angekommen",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
  no_show: "Nicht erschienen",
}

export const RIDE_STATUS_COLORS: Record<RideStatus, string> = {
  unplanned: "bg-gray-100 text-gray-800",
  planned: "bg-blue-100 text-blue-800",
  confirmed: "bg-indigo-100 text-indigo-800",
  rejected: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  picked_up: "bg-orange-100 text-orange-800",
  arrived: "bg-teal-100 text-teal-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-rose-100 text-rose-800",
}

export const RIDE_DIRECTION_LABELS: Record<RideDirection, string> = {
  outbound: "Hinfahrt",
  return: "Rückfahrt",
  both: "Hin & Rück",
}
