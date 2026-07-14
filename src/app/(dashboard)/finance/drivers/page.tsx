import type { Metadata } from "next"
import { FinancePlaceholder } from "@/components/finance/finance-placeholder"

export const metadata: Metadata = {
  title: "Fahrer-Reporting - Dispo",
}

export default function FinanceDriversPage() {
  return (
    <FinancePlaceholder title="Fahrer-Reporting" phase="Phase 14.3">
      Leistung (Fahrten/km/Zeit), Kasseninkasso und Entschädigung pro Fahrer
      inkl. CSV-Export.
    </FinancePlaceholder>
  )
}
