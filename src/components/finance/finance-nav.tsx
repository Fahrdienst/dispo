"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface FinanceNavItem {
  href: string
  label: string
}

const financeNavItems: FinanceNavItem[] = [
  { href: "/finance", label: "Dashboard" },
  { href: "/finance/receipts", label: "Quittungen" },
  { href: "/finance/drivers", label: "Fahrer" },
  { href: "/finance/statistics", label: "Statistik" },
  { href: "/finance/export", label: "Export" },
]

export function FinanceNav() {
  const pathname = usePathname()

  // Longest matching href wins so "/finance/receipts" beats "/finance".
  const activeHref =
    financeNavItems
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1">
      {financeNavItems.map((item) => {
        const isActive = item.href === activeHref
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
