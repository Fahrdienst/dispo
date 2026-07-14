"use client"

// SLOT (#132): Live-Karte im rechten Ergebnispanel.
// Functional stub: renders a labeled placeholder and the raw route figures the
// core already computed. Issue #132 replaces the placeholder body with the
// interactive/static map (e.g. the existing <RouteMap>) using the `route`
// coordinates + polyline. Keep this props contract stable.

import { MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Route</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div
          className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/30 text-center text-xs text-muted-foreground"
          aria-live="polite"
        >
          {isLoading
            ? "Route wird berechnet…"
            : route
              ? `Kartenvorschau folgt (#132) · ${formatDistance(route.distance_meters)} · ${formatDuration(route.duration_seconds)} Fahrzeit`
              : "Karte erscheint, sobald Patient und Ziel gewählt sind"}
        </div>
        {error && (
          <p className="text-xs text-amber-700" role="alert">
            Route nicht verfügbar — die Fahrt kann trotzdem gespeichert werden.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
