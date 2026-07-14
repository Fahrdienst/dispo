import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth/require-auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { FinanceNav } from "@/components/finance/finance-nav"

/**
 * /finance shell (Issue #146, ADR-015 E9). Gates the whole finance area to
 * admin + operator (mirrors the former /billing access) and renders the shared
 * section header + sub-navigation. Sub-pages render only their own content.
 */
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const auth = await requireAuth(["admin", "operator"])
  if (!auth.authorized) {
    redirect("/login")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzen"
        description="Quittungen, Fahrer-Reporting, Statistik und Export"
      />
      <FinanceNav />
      {children}
    </div>
  )
}
