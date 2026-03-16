"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import {
  CalendarClock,
  CarFront,
  Compass,
  CreditCard,
  Gauge,
  Hospital,
  LogOut,
  MapPin,
  Route,
  Settings,
  Shield,
  UserRound,
} from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  SidebarDivider,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Enums } from "@/lib/types/database"

type UserRole = Enums<"user_role">

interface NavGroup {
  items: {
    href: string
    label: string
    icon: React.ReactNode
    roles?: UserRole[]
  }[]
}

const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: <Gauge className="h-5 w-5 flex-shrink-0" />, roles: ["admin", "operator"] },
      { href: "/rides", label: "Fahrten", icon: <CarFront className="h-5 w-5 flex-shrink-0" />, roles: ["admin", "operator"] },
      { href: "/dispatch", label: "Disposition", icon: <Compass className="h-5 w-5 flex-shrink-0" />, roles: ["admin", "operator"] },
      { href: "/ride-series", label: "Fahrtserien", icon: <Route className="h-5 w-5 flex-shrink-0" />, roles: ["admin", "operator"] },
    ],
  },
  {
    items: [
      { href: "/drivers", label: "Fahrer", icon: <UserRound className="h-5 w-5 flex-shrink-0" />, roles: ["admin", "operator"] },
      { href: "/destinations", label: "Ziele", icon: <MapPin className="h-5 w-5 flex-shrink-0" />, roles: ["admin", "operator"] },
      { href: "/patients", label: "Patienten", icon: <Hospital className="h-5 w-5 flex-shrink-0" />, roles: ["admin", "operator"] },
    ],
  },
  {
    items: [
      { href: "/billing", label: "Verrechnung", icon: <CreditCard className="h-5 w-5 flex-shrink-0" />, roles: ["admin", "operator"] },
      { href: "/users", label: "Benutzer", icon: <Shield className="h-5 w-5 flex-shrink-0" />, roles: ["admin"] },
      { href: "/settings/zones", label: "Einstellungen", icon: <Settings className="h-5 w-5 flex-shrink-0" />, roles: ["admin"] },
    ],
  },
  {
    items: [
      { href: "/my/rides", label: "Meine Fahrten", icon: <CarFront className="h-5 w-5 flex-shrink-0" />, roles: ["driver"] },
      { href: "/my/availability", label: "Verfügbarkeit", icon: <CalendarClock className="h-5 w-5 flex-shrink-0" />, roles: ["driver"] },
    ],
  },
]

function Logo() {
  const { open, animate } = useSidebar()
  return (
    <Link href="/" className="flex items-center gap-2.5 px-3 py-1">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
        <span className="text-xs font-bold text-slate-900">FD</span>
      </div>
      <motion.div
        animate={{
          display: animate ? (open ? "block" : "none") : "block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: 0.15 }}
        className="leading-none"
      >
        <span className="block text-sm font-semibold tracking-tight text-white">Fahrdienst</span>
        <span className="block text-[11px] text-slate-400">Dispo Console</span>
      </motion.div>
    </Link>
  )
}

interface DashboardSidebarProps {
  role: UserRole
  logoutAction: () => Promise<void>
}

export function DashboardSidebar({ role, logoutAction }: DashboardSidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || item.roles.includes(role)
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-6 border-r border-white/10">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <Logo />
          <div className="mt-6 flex flex-col">
            {filteredGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {groupIndex > 0 && <SidebarDivider />}
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <SidebarLink
                      key={item.href}
                      link={{
                        label: item.label,
                        href: item.href,
                        icon: item.icon,
                      }}
                      active={isActive(item.href)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 pt-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <motion.span
                className="whitespace-pre"
              >
                Abmelden
              </motion.span>
            </button>
          </form>
        </div>
      </SidebarBody>
    </Sidebar>
  )
}
