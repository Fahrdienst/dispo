import type { GeoPoint } from "./types"

/**
 * Generates a Google Maps Navigation URL.
 * Prefers coordinates for higher precision. Fallbacks to address if no coords.
 */
export function getGoogleMapsNavUrl(coords?: GeoPoint | null, address?: string | null): string {
  if (coords?.lat != null && coords?.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
  }
  
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
  }

  return "https://www.google.com/maps"
}

/**
 * Generates a Google Maps Static Map URL for a route.
 */
export function getStaticMapUrl({
  origin,
  destination,
  polyline,
  width = 600,
  height = 300,
}: {
  origin: GeoPoint
  destination: GeoPoint
  polyline?: string | null
  width?: number
  height?: number
}): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return ""

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    scale: "2",
    maptype: "roadmap",
    key: apiKey,
  })

  let url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  url += `&markers=${encodeURIComponent(`color:red|label:H|${origin.lat},${origin.lng}`)}`
  url += `&markers=${encodeURIComponent(`color:blue|label:Z|${destination.lat},${destination.lng}`)}`

  if (polyline) {
    url += `&path=${encodeURIComponent(`weight:4|color:0x0000ffcc|enc:${polyline}`)}`
  }

  return url
}
