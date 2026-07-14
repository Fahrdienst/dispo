"use client"

// SLOT (#133): Live-Preis/Tarif im rechten Ergebnispanel.
//
// Reuses the exact client-side tariff pipeline already wired into `ride-form`:
//   destination PLZ  --determineTariffZone-->  zone
//   zone + direction + duration + escort + km  --calculateDuebendorfTariff-->  price
// The breakdown is rendered by the shared <TariffPriceDisplay>. This mirrors the
// authoritative server calculation in `calculateRidePrice` (#130); the action
// stays the source of truth on save. No DB call happens here -- the client zone
// lookup passes `null` for the DB zone name (same as `ride-form`), so PLZ that
// only resolve via the DB table fall through to `ausserkantonal`.

import { CreditCard } from "lucide-react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  calculateDuebendorfTariff,
  TARIFF_ZONE_LABELS,
  type TariffResult,
} from "@/lib/billing/duebendorf-tariff"
import {
  determineTariffZone,
  isTagesheimImwil,
} from "@/lib/billing/zone-determination"
import type { RideRequirement } from "@/lib/rides/requirements"
import { TariffPriceDisplay } from "../tariff-price-display"
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

/**
 * Discriminated result of the live tariff calculation: either a computed price
 * or a specific reason why no price can be shown yet. Each reason maps to a
 * friendly, non-blocking placeholder (AC #133) instead of an error.
 */
type PriceState =
  | { status: "ok"; result: TariffResult }
  | { status: "no-destination" }
  | { status: "no-plz" }
  | { status: "needs-route" }

/** Map the capture ride type onto the tariff direction. */
function toTariffDirection(rideType: RideType): "outbound" | "both" {
  return rideType === "round_trip" ? "both" : "outbound"
}

export function RidePricePanel({
  destination,
  route,
  durationCategory,
  requirements,
  rideType,
}: RidePricePanelProps) {
  const state = useMemo<PriceState>(() => {
    if (!destination) {
      return { status: "no-destination" }
    }
    if (!destination.postal_code) {
      return { status: "no-plz" }
    }

    // Client-side zone resolution (no DB zone name available here, same as the
    // ride-form). Unknown PLZ fall through to `ausserkantonal`.
    const zone = determineTariffZone(destination.postal_code, null)

    // Ausserkantonal is priced per kilometre, so it requires the route distance.
    // Until the core has computed the route, show a friendly hint rather than a
    // misleading CHF 0.00.
    if (zone === "ausserkantonal" && !route) {
      return { status: "needs-route" }
    }

    const result = calculateDuebendorfTariff({
      zone,
      direction: toTariffDirection(rideType),
      durationCategory,
      isTagesheimImwil: isTagesheimImwil(destination.display_name),
      hasEscort: requirements.includes("companion"),
      distanceKm: route ? route.distance_meters / 1000 : 0,
    })

    return { status: "ok", result }
  }, [destination, route, durationCategory, requirements, rideType])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Preis</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {state.status === "ok" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Zone: {TARIFF_ZONE_LABELS[state.result.zone]}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                CHF {state.result.price.toFixed(2)}
              </span>
            </div>
            <TariffPriceDisplay result={state.result} />
          </div>
        ) : (
          <div className="flex h-16 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-3 text-center text-xs text-muted-foreground">
            {state.status === "no-destination"
              ? "Preis erscheint, sobald ein Ziel gewählt ist."
              : state.status === "no-plz"
                ? "Für dieses Ziel ist keine PLZ hinterlegt — kein automatischer Tarif."
                : "Für ausserkantonale Ziele wird die Route benötigt — der Preis erscheint, sobald sie berechnet ist."}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
