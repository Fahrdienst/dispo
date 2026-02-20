/** Base error for all Google Maps API failures */
export class MapsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: string
  ) {
    super(message)
    this.name = "MapsApiError"
  }
}

/** Geocoding-specific failure (e.g. INVALID_REQUEST, REQUEST_DENIED) */
export class GeocodeFailedError extends MapsApiError {
  constructor(message: string, status?: string) {
    super(message, status)
    this.name = "GeocodeFailedError"
  }
}

/** Directions API failure */
export class DirectionsFailedError extends MapsApiError {
  constructor(message: string, status?: string) {
    super(message, status)
    this.name = "DirectionsFailedError"
  }
}

/** Place Details API failure */
export class PlaceDetailsFailedError extends MapsApiError {
  constructor(message: string, status?: string) {
    super(message, status)
    this.name = "PlaceDetailsFailedError"
  }
}
