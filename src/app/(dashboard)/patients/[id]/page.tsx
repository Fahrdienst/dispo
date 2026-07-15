import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { ActiveBadge } from "@/components/shared/active-badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PatientRidesReceipts } from "@/components/patients/patient-rides-receipts"
import { getToday } from "@/lib/utils/dates"
import {
  parseYearMonth,
  type RawPatientReceipt,
  type RawPatientRide,
  type RawReceiptItem,
} from "@/lib/patients/rides-receipts"

export const metadata: Metadata = {
  title: "Patientendetail - Dispo",
}

interface PatientDetailPageProps {
  params: Promise<{ id: string }>
}

/** Shape returned by the rides select (destination is a to-one join). */
interface RideQueryRow {
  id: string
  date: string
  pickup_time: string
  direction: RawPatientRide["direction"]
  status: RawPatientRide["status"]
  distance_meters: number | null
  calculated_price: number | null
  price_override: number | null
  destinations: { display_name: string } | null
}

/** Shape returned by the receipts select (items is a to-many join). */
interface ReceiptQueryRow {
  id: string
  receipt_number: string
  period_from: string
  period_to: string
  total_amount: number
  status: RawPatientReceipt["status"]
  pdf_path: string | null
  issued_at: string
  receipt_items: RawReceiptItem[]
}

export default async function PatientDetailPage({
  params,
}: PatientDetailPageProps): Promise<React.ReactElement> {
  const { id } = await params

  // Access control: patient detail is staff-only (admin/operator). Drivers are
  // already redirected to /fahrer by middleware; this is defense-in-depth and
  // mirrors the /finance area guard.
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    notFound()
  }

  const supabase = await createClient()

  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name, is_active")
    .eq("id", id)
    .single()

  if (!patient) {
    notFound()
  }

  // Load the patient's active rides (with destination) and receipts (with items)
  // in parallel. RLS restricts both to admin/operator.
  const [{ data: rideData }, { data: receiptData }] = await Promise.all([
    supabase
      .from("rides")
      .select(
        "id, date, pickup_time, direction, status, distance_meters, calculated_price, price_override, destinations(display_name)"
      )
      .eq("patient_id", id)
      .eq("is_active", true)
      .order("date", { ascending: false })
      .order("pickup_time", { ascending: false }),
    supabase
      .from("receipts")
      .select(
        "id, receipt_number, period_from, period_to, total_amount, status, pdf_path, issued_at, receipt_items(ride_id, is_cancelled)"
      )
      .eq("patient_id", id)
      .order("issued_at", { ascending: false }),
  ])

  const rideRows = (rideData ?? []) as unknown as RideQueryRow[]
  const receiptRows = (receiptData ?? []) as unknown as ReceiptQueryRow[]

  // Map to the pure-logic input shapes.
  const rides: RawPatientRide[] = rideRows.map((r) => ({
    id: r.id,
    date: r.date,
    pickup_time: r.pickup_time,
    direction: r.direction,
    status: r.status,
    distance_meters: r.distance_meters,
    calculated_price: r.calculated_price,
    price_override: r.price_override,
    destination: r.destinations,
  }))

  const receiptItems: RawReceiptItem[] = receiptRows.flatMap(
    (r) => r.receipt_items
  )

  const receipts: RawPatientReceipt[] = receiptRows.map((r) => ({
    id: r.id,
    receipt_number: r.receipt_number,
    period_from: r.period_from,
    period_to: r.period_to,
    total_amount: r.total_amount,
    status: r.status,
    pdf_path: r.pdf_path,
  }))

  const { year, month0 } = parseYearMonth(getToday())
  const fullName = `${patient.last_name}, ${patient.first_name}`

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        description="Fahrten & Quittungen"
        backHref="/patients"
        backLabel="Patienten"
        actions={
          <>
            <ActiveBadge isActive={patient.is_active} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/${patient.id}/edit`}>Bearbeiten</Link>
            </Button>
          </>
        }
      />

      <PatientRidesReceipts
        patientId={patient.id}
        rides={rides}
        receiptItems={receiptItems}
        receipts={receipts}
        canCreateReceipt={auth.role === "admin" || auth.role === "operator"}
        currentYear={year}
        currentMonth0={month0}
      />
    </div>
  )
}
