"use client"

// SLOT (#132): Live-Karte im rechten Ergebnispanel.
//
// The core (ride-capture-form) already computes the route once via the
// `calculateRouteForRide` server action and hands the result down as `route`.
// This panel only *renders* that result -- it never issues a Maps web-service
// call of its own (Marco's cost constraint). The map itself reuses the shared
// <RouteMap>, which draws the static-map image client-side with the public,
// referer-restricted key. On top of the map we surface distance + drive time
// (AC #132) and a non-blocking hint when the route could not be resolved.

import { Clock, MapPin, Navigation } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RouteMap } from "@/components/shared/route-map"
import type { RouteInfo } from "./types"

export interface RideMapPanelProps {
  /** Calculated route (coords + polyline + distance/duration), or null. */
  route: RouteInfo | null
  /** True while the route request is in flight. */
  isLoading: boolean
  /** Route calculation error (non-blocking), or null. */
  error: string | null
}

function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(1) + " km"
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} Std. ${rest} Min.` : `${hours} Std.`
}

export function RideMapPanel({ route, isLoading, error }: RideMapPanelProps) {
  // <RouteMap> only renders with a valid API key. Without it we still want the
  // labelled card (and the metrics strip below) so the panel never disappears.
  const hasApiKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)

  return (
    <div className="space-y-2">
      {route !== null && hasApiKey ? (
        <RouteMap
          originLat={route.origin_lat}
          originLng={route.origin_lng}
          destLat={route.dest_lat}
          destLng={route.dest_lng}
          polyline={route.polyline}
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Route</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-3 text-center text-xs text-muted-foreground"
              aria-live="polite"
            >
              {isLoading
                ? "Route wird berechnet…"
                : route !== null
                  ? "Kartenvorschau nicht verfügbar (kein Karten-Schlüssel) — Distanz und Fahrzeit siehe unten."
                  : "Karte erscheint, sobald Patient und Ziel gewählt sind."}
            </div>
          </CardContent>
        </Card>
      )}

      {route !== null && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Distanz:{" "}
              <span className="font-medium text-foreground">
                {formatDistance(route.distance_meters)}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Fahrzeit:{" "}
              <span className="font-medium text-foreground">
                {formatDuration(route.duration_seconds)}
              </span>
            </span>
          </span>
        </div>
      )}

      {error !== null && (
        <p className="text-xs text-amber-700" role="alert">
          Route nicht verfügbar — die Fahrt kann trotzdem gespeichert werden.
        </p>
      )}
    </div>
  )
}
