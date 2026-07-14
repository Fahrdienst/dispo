import type { Metadata } from "next"
import { FinancePlaceholder } from "@/components/finance/finance-placeholder"

export const metadata: Metadata = {
  title: "Statistik - Dispo",
}

export default function FinanceStatisticsPage() {
  return (
    <FinancePlaceholder title="Statistik" phase="Phase 14.4">
      Flexible Auswertung (Dimension × Kennzahl × Zeitraum) über Fahrten, km,
      Fahrzeit und Umsatz inkl. CSV-Export.
    </FinancePlaceholder>
  )
}
