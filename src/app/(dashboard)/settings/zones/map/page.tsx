import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { MapPin } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/require-auth"
import { retroStyleUrlParams } from "@/lib/maps/styles"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"
import { Breadcrumb } from "@/components/shared/breadcrumb"
import { ZoneMapPostalList } from "@/components/zones/zone-map-postal-list"

export const metadata: Metadata = {
  title: "Zonenkarte - Dispo",
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PostalCodeCoords {
  postalCode: string
  lat: number
  lng: number
}

interface ZoneWithPostalCodes {
  id: string
  name: string
  postalCodes: string[]
}

// ─── Marker color assignment based on zone name ──────────────────────────────

function getMarkerColor(zoneName: string): string {
  const lower = zoneName.toLowerCase()
  if (lower.includes("gemeinde")) return "0x22c55e" // green
  if (lower.includes("zone 1")) return "0xeab308"   // yellow
  if (lower.includes("zone 2")) return "0xf97316"   // orange
  if (lower.includes("zone 3")) return "0xef4444"   // red
  return "0x6b7280" // gray fallback
}

function getMarkerLabel(zoneName: string): string {
  const lower = zoneName.toLowerCase()
  if (lower.includes("gemeinde")) return "G"
  if (lower.includes("zone 1")) return "1"
  if (lower.includes("zone 2")) return "2"
  if (lower.includes("zone 3")) return "3"
  return "X"
}

// ─── Static Map URL builder ──────────────────────────────────────────────────

const MAX_URL_LENGTH = 8000
const DUEBENDORF_CENTER = "47.397,8.618"

function buildStaticMapUrl(
  apiKey: string,
  coordsByZone: Map<string, PostalCodeCoords[]>,
  unassignedCoords: PostalCodeCoords[]
): string {
  const params = new URLSearchParams({
    center: DUEBENDORF_CENTER,
    zoom: "11",
    size: "640x480",
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  })

  let url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  url += retroStyleUrlParams()

  // Collect all marker groups
  const markerGroups: { color: string; label: string; coords: string[] }[] = []

  for (const [zoneName, coords] of coordsByZone) {
    if (coords.length === 0) continue
    markerGroups.push({
      color: getMarkerColor(zoneName),
      label: getMarkerLabel(zoneName),
      coords: coords.map((c) => `${c.lat},${c.lng}`),
    })
  }

  if (unassignedCoords.length > 0) {
    markerGroups.push({
      color: "0x6b7280",
      label: "X",
      coords: unassignedCoords.map((c) => `${c.lat},${c.lng}`),
    })
  }

  // Add markers, respecting URL length limit
  for (const group of markerGroups) {
    const markerParam = `&markers=${encodeURIComponent(
      `color:${group.color}|label:${group.label}|${group.coords.join("|")}`
    )}`

    if (url.length + markerParam.length > MAX_URL_LENGTH) {
      // Truncate: only add as many coords as fit
      let truncatedCoords: string[] = []
      for (const coord of group.coords) {
        const testParam = `&markers=${encodeURIComponent(
          `color:${group.color}|label:${group.label}|${[...truncatedCoords, coord].join("|")}`
        )}`
        if (url.length + testParam.length > MAX_URL_LENGTH) break
        truncatedCoords.push(coord)
      }
      if (truncatedCoords.length > 0) {
        url += `&markers=${encodeURIComponent(
          `color:${group.color}|label:${group.label}|${truncatedCoords.join("|")}`
        )}`
      }
      break // No room for more groups
    }

    url += markerParam
  }

  return url
}

// ─── Tariff summary data ─────────────────────────────────────────────────────

const TARIFF_SUMMARY = [
  { zone: "Gemeinde", single: "CHF 8", roundUnder2h: "CHF 12", roundOver2h: "CHF 16" },
  { zone: "Zone 1", single: "-", roundUnder2h: "CHF 16", roundOver2h: "CHF 24" },
  { zone: "Zone 2", single: "-", roundUnder2h: "CHF 25", roundOver2h: "CHF 45" },
  { zone: "Zone 3", single: "-", roundUnder2h: "CHF 35", roundOver2h: "CHF 55" },
  { zone: "Ausserkantonal", single: "-", roundUnder2h: "CHF 1/km", roundOver2h: "CHF 1/km" },
] as const

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ZoneMapPage() {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  const supabase = await createClient()

  // Parallel data loading
  const [zonesRes, patientsRes, destinationsRes] = await Promise.all([
    supabase
      .from("zones")
      .select("id, name, is_active, zone_postal_codes(postal_code)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("patients")
      .select("postal_code, lat, lng")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .not("postal_code", "is", null),
    supabase
      .from("destinations")
      .select("postal_code, lat, lng")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .not("postal_code", "is", null),
  ])

  const zones = zonesRes.data ?? []
  const patients = patientsRes.data ?? []
  const destinations = destinationsRes.data ?? []

  // Build zone lookup: postal_code -> zone info
  const zonesByPostalCode = new Map<string, { zoneId: string; zoneName: string }>()
  const zoneList: ZoneWithPostalCodes[] = []

  for (const zone of zones) {
    const postalCodes: string[] = []
    const codes = zone.zone_postal_codes as Array<{ postal_code: string }> | null
    for (const zpc of codes ?? []) {
      zonesByPostalCode.set(zpc.postal_code, { zoneId: zone.id, zoneName: zone.name })
      postalCodes.push(zpc.postal_code)
    }
    zoneList.push({ id: zone.id, name: zone.name, postalCodes })
  }

  // Average coordinates per postal code from patients + destinations
  const coordAccumulator = new Map<string, { latSum: number; lngSum: number; count: number }>()

  for (const row of [...patients, ...destinations]) {
    const plz = row.postal_code
    if (!plz || row.lat == null || row.lng == null) continue
    const existing = coordAccumulator.get(plz)
    if (existing) {
      existing.latSum += row.lat
      existing.lngSum += row.lng
      existing.count += 1
    } else {
      coordAccumulator.set(plz, { latSum: row.lat, lngSum: row.lng, count: 1 })
    }
  }

  const coordsByPlz = new Map<string, { lat: number; lng: number }>()
  for (const [plz, acc] of coordAccumulator) {
    coordsByPlz.set(plz, {
      lat: Math.round((acc.latSum / acc.count) * 100000) / 100000,
      lng: Math.round((acc.lngSum / acc.count) * 100000) / 100000,
    })
  }

  // Collect all known postal codes (from zones + from geocoded data)
  const allPostalCodes = new Set<string>([
    ...zonesByPostalCode.keys(),
    ...coordsByPlz.keys(),
  ])
  const sortedPostalCodes = [...allPostalCodes].sort()

  // Build marker groups by zone
  const coordsByZoneName = new Map<string, PostalCodeCoords[]>()
  const unassignedCoords: PostalCodeCoords[] = []

  for (const plz of sortedPostalCodes) {
    const coords = coordsByPlz.get(plz)
    if (!coords) continue

    const zone = zonesByPostalCode.get(plz)
    if (zone) {
      const existing = coordsByZoneName.get(zone.zoneName) ?? []
      existing.push({ postalCode: plz, lat: coords.lat, lng: coords.lng })
      coordsByZoneName.set(zone.zoneName, existing)
    } else {
      unassignedCoords.push({ postalCode: plz, lat: coords.lat, lng: coords.lng })
    }
  }

  // Build postal code list for the sidebar
  const postalCodeEntries = sortedPostalCodes.map((plz) => {
    const zone = zonesByPostalCode.get(plz)
    return {
      postalCode: plz,
      zoneId: zone?.zoneId ?? null,
      zoneName: zone?.zoneName ?? null,
      hasCoordinates: coordsByPlz.has(plz),
    }
  })

  const zoneOptions = zones.map((z) => ({ id: z.id, name: z.name }))

  // Static Map
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const hasMapMarkers = coordsByPlz.size > 0
  const mapUrl =
    apiKey && hasMapMarkers
      ? buildStaticMapUrl(apiKey, coordsByZoneName, unassignedCoords)
      : null

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Einstellungen", href: "/settings/zones" },
          { label: "Zonen", href: "/settings/zones" },
          { label: "Zonenkarte" },
        ]}
      />
      <PageHeader
        title="Zonenkarte"
        description="Visuelle Uebersicht der Tarifzonen mit PLZ-Zuordnung."
        backHref="/settings/zones"
        backLabel="Zurueck zu Zonen"
      />
      <SettingsNav />

      {/* Map + List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map area - 2/3 width */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border bg-background">
            {mapUrl ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapUrl}
                  alt="Zonenkarte mit farbcodierten PLZ-Markern"
                  width={640}
                  height={480}
                  loading="eager"
                  className="h-auto w-full"
                />
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 p-6">
                <MapPin className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {!apiKey
                    ? "Google Maps API-Key nicht konfiguriert"
                    : "Keine geocodierten Adressen vorhanden"}
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 border-t px-4 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden="true" />
                Gemeinde
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" aria-hidden="true" />
                Zone 1
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden="true" />
                Zone 2
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                Zone 3
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" aria-hidden="true" />
                Keine Zone
              </span>
            </div>
          </div>
        </div>

        {/* PLZ list - 1/3 width */}
        <div className="lg:col-span-1">
          <ZoneMapPostalList postalCodes={postalCodeEntries} zones={zoneOptions} />
        </div>
      </div>

      {/* Tariff summary */}
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Tarifuebersicht</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Zone</th>
                <th className="px-4 py-2 text-left font-medium">Einfach</th>
                <th className="px-4 py-2 text-left font-medium">H+R bis 2h</th>
                <th className="px-4 py-2 text-left font-medium">H+R ab 2h</th>
              </tr>
            </thead>
            <tbody>
              {TARIFF_SUMMARY.map((row) => (
                <tr key={row.zone} className="border-t">
                  <td className="px-4 py-2 font-medium">{row.zone}</td>
                  <td className="px-4 py-2">{row.single}</td>
                  <td className="px-4 py-2">{row.roundUnder2h}</td>
                  <td className="px-4 py-2">{row.roundOver2h}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          Sonderfall: Tagesheim Imwil (H+R) = CHF 14 | Ausserkantonal: +CHF 20 Begleitungszuschlag
        </div>
      </div>
    </div>
  )
}
