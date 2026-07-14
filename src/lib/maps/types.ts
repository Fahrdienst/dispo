/** WGS84 coordinate pair */
export interface GeoPoint {
  lat: number
  lng: number
}

/** Result from the Google Geocoding API */
export interface GeocodeResult {
  lat: number
  lng: number
  place_id: string
  formatted_address: string
}

/** Result from the Google Directions API */
export interface RouteResult {
  distance_meters: number
  duration_seconds: number
  /** Encoded polyline for later map display */
  polyline: string
}

/** Address input for geocoding (Swiss format) */
export interface AddressInput {
  street: string
  /** Optional: many imported facility addresses have no separate house number
   *  (it's embedded in `street` or genuinely absent). Google geocodes fine
   *  without it. */
  house_number?: string | null
  postal_code: string
  city: string
}
