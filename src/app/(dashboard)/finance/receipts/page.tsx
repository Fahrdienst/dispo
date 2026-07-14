import type { Metadata } from "next"
import { FinancePlaceholder } from "@/components/finance/finance-placeholder"

export const metadata: Metadata = {
  title: "Quittungen - Dispo",
}

export default function FinanceReceiptsPage() {
  return (
    <FinancePlaceholder title="Quittungen" phase="Phase 14.2 / 14.3">
      Erstellen, Ansehen, Stornieren und Sammellauf von Zahlungsbestätigungen.
      Das Datenmodell (receipts) steht bereits.
    </FinancePlaceholder>
  )
}
