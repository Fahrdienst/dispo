"use client"

import { useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { updatePostalCodeZone } from "@/actions/zones"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ZoneOption {
  id: string
  name: string
}

interface PostalCodeEntry {
  postalCode: string
  zoneId: string | null
  zoneName: string | null
  hasCoordinates: boolean
}

interface ZoneMapPostalListProps {
  postalCodes: PostalCodeEntry[]
  zones: ZoneOption[]
}

// ─── Zone color mapping (matches marker colors on the map) ───────────────────

const ZONE_DOT_CLASSES: Record<string, string> = {
  Gemeinde: "bg-green-500",
  "Zone 1": "bg-yellow-500",
  "Zone 2": "bg-orange-500",
  "Zone 3": "bg-red-500",
}

function getZoneDotClass(zoneName: string | null): string {
  if (!zoneName) return "bg-gray-400"
  for (const [key, cls] of Object.entries(ZONE_DOT_CLASSES)) {
    if (zoneName.toLowerCase().includes(key.toLowerCase())) return cls
  }
  return "bg-gray-400"
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ZoneMapPostalList({ postalCodes, zones }: ZoneMapPostalListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleZoneChange(postalCode: string, newZoneId: string): void {
    setError(null)
    const zoneId = newZoneId === "" ? null : newZoneId

    startTransition(async () => {
      const result = await updatePostalCodeZone(postalCode, zoneId)
      if (!result.success) {
        setError(result.error ?? "Fehler beim Aktualisieren")
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">
        PLZ-Zuordnung ({postalCodes.length})
      </h3>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="max-h-[520px] overflow-y-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">PLZ</th>
              <th className="px-3 py-2 text-left font-medium">Zone</th>
            </tr>
          </thead>
          <tbody>
            {postalCodes.map((entry) => (
              <tr
                key={entry.postalCode}
                className="border-t transition-colors hover:bg-muted/50"
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${getZoneDotClass(entry.zoneName)}`}
                      aria-hidden="true"
                    />
                    <span className="font-mono">{entry.postalCode}</span>
                    {!entry.hasCoordinates && (
                      <span
                        className="text-xs text-muted-foreground"
                        title="Keine Koordinaten vorhanden"
                      >
                        (?)
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    value={entry.zoneId ?? ""}
                    onChange={(e) => handleZoneChange(entry.postalCode, e.target.value)}
                    disabled={isPending}
                    aria-label={`Zone fuer PLZ ${entry.postalCode}`}
                  >
                    <option value="">-- Keine Zone --</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {postalCodes.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                  Keine PLZ gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isPending && (
        <p className="text-xs text-muted-foreground">Wird aktualisiert...</p>
      )}
    </div>
  )
}
