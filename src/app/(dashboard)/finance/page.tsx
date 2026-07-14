import type { Metadata } from "next"
import { FinancePlaceholder } from "@/components/finance/finance-placeholder"

export const metadata: Metadata = {
  title: "Finanzen - Dispo",
}

export default function FinanceDashboardPage() {
  return (
    <FinancePlaceholder title="Dashboard" phase="Phase 14.4">
      KPI-Kacheln (Umsatz, Fahrten, gefahrene km, Ø Preis), Umsatzverlauf und
      Top-Listen werden hier ausgewiesen.
    </FinancePlaceholder>
  )
}
