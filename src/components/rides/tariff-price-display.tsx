"use client"

import type { TariffResult } from "@/lib/billing/duebendorf-tariff"

interface TariffPriceDisplayProps {
  result: TariffResult | null
  isLoading?: boolean
}

/**
 * Displays the calculated tariff price with a line-by-line breakdown.
 * Shows zone, tariff type, and each price component.
 */
export function TariffPriceDisplay({
  result,
  isLoading = false,
}: TariffPriceDisplayProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
      </div>
    )
  }

  if (!result) {
    return null
  }

  return (
    <div className="space-y-2 text-sm" aria-label="Tarifberechnung">
      <p className="font-medium text-muted-foreground">
        Tarif: {result.tariffType}
      </p>
      <div className="space-y-1 font-mono text-xs">
        {result.breakdown.map((item, index) => (
          <div key={index} className="flex justify-between">
            <span>{item.label}</span>
            <span>CHF {item.amount.toFixed(2)}</span>
          </div>
        ))}
        {result.breakdown.length > 1 && (
          <>
            <div className="border-t border-dashed border-muted-foreground/30 pt-1" aria-hidden="true" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>CHF {result.price.toFixed(2)}</span>
            </div>
          </>
        )}
        {result.breakdown.length === 1 && (
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>CHF {result.price.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
