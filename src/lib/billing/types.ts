import type { TariffZone, TariffBreakdownItem } from "./duebendorf-tariff"

/** Result of an automatic price calculation for a ride */
export interface PriceCalculation {
  /** Calculated price in CHF */
  calculated_price: number
  /** ID of the fare rule used (legacy, may be null for new tariff) */
  fare_rule_id: string | null
  /** Route distance in meters from Google Directions API */
  distance_meters: number
  /** Route duration in seconds from Google Directions API */
  duration_seconds: number
  /** Resolved tariff zone */
  tariff_zone: TariffZone | null
  /** Human-readable price breakdown items */
  breakdown: TariffBreakdownItem[]
  /** Surcharge amount in CHF */
  surcharge_amount: number
}
