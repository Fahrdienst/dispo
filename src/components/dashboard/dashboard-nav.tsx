"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Enums } from "@/lib/types/database"

type UserRole = Enums<"user_role">

interface NavItem {
  href: string
  label: string
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["admin", "operator"] },
  { href: "/rides", label: "Fahrten", roles: ["admin", "operator"] },
  { href: "/dispatch", label: "Disposition", roles: ["admin", "operator"] },
  { href: "/ride-series", label: "Fahrtserien", roles: ["admin", "operator"] },
  { href: "/drivers", label: "Fahrer", roles: ["admin", "operator"] },
  { href: "/destinations", label: "Ziele", roles: ["admin", "operator"] },
  { href: "/patients", label: "Patienten", roles: ["admin", "operator"] },
  { href: "/billing", label: "Verrechnung", roles: ["admin", "operator"] },
  { href: "/users", label: "Benutzer", roles: ["admin"] },
  { href: "/settings/zones", label: "Einstellungen", roles: ["admin"] },
  { href: "/my/rides", label: "Meine Fahrten", roles: ["driver"] },
  { href: "/my/availability", label: "Meine Verfuegbarkeit", roles: ["driver"] },
]

interface DashboardNavProps {
  role: UserRole
}

export function DashboardNav({ role }: DashboardNavProps) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <nav className="flex items-center gap-6">
      {visibleItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative pb-0.5 text-sm font-medium transition-colors",
              isActive
                ? "text-white after:absolute after:bottom-[-17px] after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-white"
                : "text-gray-400 hover:text-gray-200"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
