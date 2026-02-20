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
              "text-sm font-medium transition-colors hover:text-foreground",
              isActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
