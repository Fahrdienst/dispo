/** Result of an automatic price calculation for a ride */
export interface PriceCalculation {
  /** Calculated price in CHF (base_price + distance_km * price_per_km) */
  calculated_price: number
  /** ID of the fare rule used for the calculation */
  fare_rule_id: string
  /** Route distance in meters from Google Directions API */
  distance_meters: number
  /** Route duration in seconds from Google Directions API */
  duration_seconds: number
}
