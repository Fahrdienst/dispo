import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { createClient } from "@/lib/supabase/server"
import { getToday } from "@/lib/utils/dates"
import {
  RIDE_STATUS_LABELS,
  RIDE_DIRECTION_LABELS,
} from "@/lib/rides/constants"
import { PrintTrigger } from "@/components/dispatch/print-trigger"
import type { Enums } from "@/lib/types/database"

export const metadata: Metadata = {
  title: "Tagesplan drucken - Dispo",
}

// =============================================================================
// Types
// =============================================================================

interface PrintRide {
  id: string
  pickup_time: string
  appointment_time: string | null
  direction: Enums<"ride_direction">
  status: Enums<"ride_status">
  notes: string | null
  patient_last_name: string
  patient_first_name: string
  patient_phone: string | null
  destination_name: string
  driver_name: string | null
}

// =============================================================================
// Helpers
// =============================================================================

const WEEKDAY_LONG: Record<number, string> = {
  0: "Sonntag",
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
}

const MONTH_LONG: Record<number, string> = {
  0: "Januar",
  1: "Februar",
  2: "Maerz",
  3: "April",
  4: "Mai",
  5: "Juni",
  6: "Juli",
  7: "August",
  8: "September",
  9: "Oktober",
  10: "November",
  11: "Dezember",
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const weekday = WEEKDAY_LONG[d.getDay()] ?? ""
  const day = d.getDate()
  const month = MONTH_LONG[d.getMonth()] ?? ""
  const year = d.getFullYear()
  return `${weekday}, ${day}. ${month} ${year}`
}

function formatTimestamp(): string {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, "0")
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const year = now.getFullYear()
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  return `${day}.${month}.${year} ${hours}:${minutes}`
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value))
}

// =============================================================================
// Page
// =============================================================================

interface PrintPageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function DispatchPrintPage({
  searchParams,
}: PrintPageProps) {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const params = await searchParams
  const date =
    params.date && isValidDate(params.date) ? params.date : getToday()

  // Fetch rides for the day with patient, destination, driver
  const supabase = await createClient()

  const { data: rides, error } = await supabase
    .from("rides")
    .select(
      "id, pickup_time, appointment_time, direction, status, notes, patients(first_name, last_name, phone), destinations(display_name), drivers(first_name, last_name)"
    )
    .eq("date", date)
    .eq("is_active", true)
    .order("pickup_time")

  if (error) {
    console.error("Failed to fetch print rides:", error.message)
  }

  // Map to typed rows
  const printRides: PrintRide[] = (rides ?? []).map((ride) => {
    const patient = ride.patients as {
      first_name: string
      last_name: string
      phone: string | null
    } | null
    const destination = ride.destinations as {
      display_name: string
    } | null
    const driver = ride.drivers as {
      first_name: string
      last_name: string
    } | null

    return {
      id: ride.id,
      pickup_time: ride.pickup_time.substring(0, 5),
      appointment_time: ride.appointment_time
        ? ride.appointment_time.substring(0, 5)
        : null,
      direction: ride.direction,
      status: ride.status,
      notes: ride.notes,
      patient_last_name: patient?.last_name ?? "\u2013",
      patient_first_name: patient?.first_name ?? "",
      patient_phone: patient?.phone ?? null,
      destination_name: destination?.display_name ?? "\u2013",
      driver_name: driver
        ? `${driver.last_name}, ${driver.first_name}`
        : null,
    }
  })

  const unplannedCount = printRides.filter(
    (r) => r.status === "unplanned" || r.driver_name === null
  ).length

  return (
    <>
      {/* Print trigger (client component for window.print) */}
      <PrintTrigger />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A4 landscape;
              margin: 12mm;
            }

            .print-content {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
              font-size: 11px;
              line-height: 1.4;
              color: #000;
            }

            .print-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }

            .print-header h1 {
              font-size: 18px;
              font-weight: 700;
              margin: 0;
            }

            .print-header .subtitle {
              font-size: 13px;
              color: #333;
              margin: 2px 0 0;
            }

            .print-header .meta {
              font-size: 10px;
              color: #666;
              text-align: right;
            }

            .print-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }

            .print-table th,
            .print-table td {
              border: 1px solid #ccc;
              padding: 4px 6px;
              text-align: left;
              vertical-align: top;
            }

            .print-table th {
              background: #f0f0f0;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }

            .print-table td {
              font-size: 11px;
            }

            .print-table tr:nth-child(even) td {
              background: #fafafa;
            }

            .print-table .unplanned td {
              background: #fff3cd;
            }

            .print-table .cancelled td {
              background: #f8d7da;
              text-decoration: line-through;
              color: #666;
            }

            .print-summary {
              border-top: 2px solid #000;
              padding-top: 8px;
              font-size: 12px;
              font-weight: 600;
            }

            .no-print {
              margin-bottom: 16px;
            }

            .screen-actions {
              display: flex;
              gap: 8px;
              margin-bottom: 16px;
            }

            .screen-actions a {
              padding: 8px 16px;
              font-size: 13px;
              border: 1px solid #ccc;
              border-radius: 6px;
              background: #fff;
              cursor: pointer;
              text-decoration: none;
              color: #000;
            }

            .screen-actions a:hover {
              background: #f0f0f0;
            }

            @media print {
              /* Hide dashboard sidebar and navigation */
              [data-sidebar], nav, aside, header {
                display: none !important;
              }

              .no-print {
                display: none !important;
              }

              /* Reset dashboard layout constraints */
              body {
                background: white !important;
              }

              main {
                margin: 0 !important;
                padding: 0 !important;
                max-width: none !important;
                overflow: visible !important;
              }

              /* Remove dashboard wrapper flex layout */
              body > div,
              body > div > div {
                display: block !important;
                overflow: visible !important;
                max-width: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
            }
          `,
        }}
      />

      <div className="print-content">
        {/* Screen-only back button */}
        <div className="no-print screen-actions">
          <a href={`/dispatch?date=${date}`}>Zurueck zur Disposition</a>
        </div>

        {/* Header */}
        <div className="print-header">
          <div>
            <h1>Fahrdienst &mdash; Tagesplan</h1>
            <p className="subtitle">
              {formatDateLong(date)}
            </p>
          </div>
          <div className="meta">
            Erstellt: {formatTimestamp()}
          </div>
        </div>

        {/* Table */}
        {printRides.length === 0 ? (
          <p style={{ padding: "20px 0", textAlign: "center", color: "#666" }}>
            Keine Fahrten fuer diesen Tag.
          </p>
        ) : (
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Zeit</th>
                <th style={{ width: "50px" }}>Termin</th>
                <th style={{ width: "40px" }}>Richtg.</th>
                <th>Patient</th>
                <th style={{ width: "100px" }}>Telefon</th>
                <th>Ziel</th>
                <th>Fahrer</th>
                <th style={{ width: "70px" }}>Status</th>
                <th>Bemerkungen</th>
              </tr>
            </thead>
            <tbody>
              {printRides.map((ride) => {
                const rowClass =
                  ride.status === "cancelled" || ride.status === "no_show"
                    ? "cancelled"
                    : ride.driver_name === null || ride.status === "unplanned"
                      ? "unplanned"
                      : ""

                return (
                  <tr key={ride.id} className={rowClass}>
                    <td style={{ fontWeight: 600 }}>{ride.pickup_time}</td>
                    <td>{ride.appointment_time ?? "\u2013"}</td>
                    <td>{RIDE_DIRECTION_LABELS[ride.direction]}</td>
                    <td style={{ fontWeight: 500 }}>
                      {ride.patient_last_name}, {ride.patient_first_name}
                    </td>
                    <td style={{ fontSize: "10px" }}>
                      {ride.patient_phone ?? "\u2013"}
                    </td>
                    <td>{ride.destination_name}</td>
                    <td>{ride.driver_name ?? <em>offen</em>}</td>
                    <td>{RIDE_STATUS_LABELS[ride.status]}</td>
                    <td style={{ fontSize: "10px", color: "#555" }}>
                      {ride.notes ?? ""}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Summary */}
        <div className="print-summary">
          Zusammenfassung: {printRides.length} Fahrt{printRides.length !== 1 ? "en" : ""}
          {unplannedCount > 0 && (
            <>, davon {unplannedCount} ohne Fahrer</>
          )}
        </div>
      </div>
    </>
  )
}
