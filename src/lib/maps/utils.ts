import type { GeoPoint } from "./types"

/**
 * Builds a Static Maps `visible=` parameter from a set of coordinates.
 *
 * The Static Maps API auto-fits all markers into the requested image, but adds
 * no meaningful margin — marker pins near the edge get clipped. By computing the
 * bounding box of all points, padding it, and forcing the padded corners to be
 * `visible`, we guarantee some breathing room around every marker.
 *
 * @param coords  Coordinate strings in "lat,lng" format.
 * @param paddingRatio  Fraction of the span to add on each side (default 0.15 = 15%).
 * @returns A URL fragment like `&visible=minLat,minLng|maxLat,maxLng`, or an
 *          empty string if no valid coordinates were provided.
 */
export function getPaddedVisibleParam(coords: string[], paddingRatio = 0.15): string {
  const points = coords
    .map((c) => {
      const [latStr, lngStr] = c.split(",")
      const lat = Number(latStr)
      const lng = Number(lngStr)
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
    })
    .filter((p): p is GeoPoint => p !== null)

  if (points.length === 0) return ""

  let minLat = points[0]!.lat
  let maxLat = points[0]!.lat
  let minLng = points[0]!.lng
  let maxLng = points[0]!.lng

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }

  // Minimum padding (in degrees) so a single point or a very tight cluster still
  // gets a sensible zoom-out instead of a maximally-zoomed street view.
  const MIN_PADDING_DEG = 0.008

  const latPad = Math.max((maxLat - minLat) * paddingRatio, MIN_PADDING_DEG)
  const lngPad = Math.max((maxLng - minLng) * paddingRatio, MIN_PADDING_DEG)

  const paddedMinLat = minLat - latPad
  const paddedMaxLat = maxLat + latPad
  const paddedMinLng = minLng - lngPad
  const paddedMaxLng = maxLng + lngPad

  return `&visible=${paddedMinLat},${paddedMinLng}|${paddedMaxLat},${paddedMaxLng}`
}

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
