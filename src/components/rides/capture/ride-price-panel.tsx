"use client"

// SLOT (#133): Live-Preis/Tarif im rechten Ergebnispanel.
// Functional stub: renders a labeled placeholder. Issue #133 computes and shows
// the Dübendorf tariff breakdown from these inputs (zone from destination PLZ,
// distance from `route`, `durationCategory`, escort/requirements, `rideType`
// for round-trip pricing). The server action stays authoritative on save.

import { CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RideRequirement } from "@/lib/rides/requirements"
import type {
  CaptureDestination,
  DurationCategory,
  RideType,
  RouteInfo,
} from "./types"

export interface RidePricePanelProps {
  /** Selected destination (its PLZ drives the tariff zone), or null. */
  destination: CaptureDestination | null
  /** Calculated route (its distance drives ausserkantonal per-km fares), or null. */
  route: RouteInfo | null
  /** Stay-duration bucket derived from the appointment duration. */
  durationCategory: DurationCategory
  /** Ride requirements (e.g. `companion` implies an escort surcharge). */
  requirements: RideRequirement[]
  /** Round-trip vs. one-way — affects the tariff. */
  rideType: RideType
}

export function RidePricePanel(_props: RidePricePanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Preis</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-16 items-center justify-center rounded-lg border border-dashed bg-muted/30 text-center text-xs text-muted-foreground">
          Tarifberechnung folgt (#133)
        </div>
      </CardContent>
    </Card>
  )
}
