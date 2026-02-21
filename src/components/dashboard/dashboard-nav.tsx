"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentType } from "react"
import {
  CalendarClock,
  CarFront,
  Compass,
  CreditCard,
  Gauge,
  Hospital,
  MapPin,
  Route,
  Settings,
  Shield,
  UserRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Enums } from "@/lib/types/database"

type UserRole = Enums<"user_role">

interface NavItem {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Gauge, roles: ["admin", "operator"] },
  { href: "/rides", label: "Fahrten", icon: CarFront, roles: ["admin", "operator"] },
  { href: "/dispatch", label: "Disposition", icon: Compass, roles: ["admin", "operator"] },
  { href: "/ride-series", label: "Fahrtserien", icon: Route, roles: ["admin", "operator"] },
  { href: "/drivers", label: "Fahrer", icon: UserRound, roles: ["admin", "operator"] },
  { href: "/destinations", label: "Ziele", icon: MapPin, roles: ["admin", "operator"] },
  { href: "/patients", label: "Patienten", icon: Hospital, roles: ["admin", "operator"] },
  { href: "/billing", label: "Verrechnung", icon: CreditCard, roles: ["admin", "operator"] },
  { href: "/users", label: "Benutzer", icon: Shield, roles: ["admin"] },
  { href: "/settings/zones", label: "Einstellungen", icon: Settings, roles: ["admin"] },
  { href: "/my/rides", label: "Meine Fahrten", icon: CarFront, roles: ["driver"] },
  { href: "/my/availability", label: "Verfuegbarkeit", icon: CalendarClock, roles: ["driver"] },
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
    <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
      {visibleItems.map((item) => {
        const Icon = item.icon
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all",
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-100/90 hover:bg-white/20 hover:text-white"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
