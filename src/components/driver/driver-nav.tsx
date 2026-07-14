"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CalendarClock, CalendarX, User, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Match the path exactly (used for the section root "/fahrer"). */
  exact?: boolean
}

/**
 * Primary driver navigation. Kept complete so the Verfügbarkeit / Abwesenheiten
 * pages (built separately) only need to add their route, never touch the nav.
 * Labels are deliberately short so four items fit at 375px without wrapping.
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/fahrer", label: "Übersicht", icon: Home, exact: true },
  { href: "/fahrer/verfuegbarkeit", label: "Verfügbar", icon: CalendarClock },
  { href: "/fahrer/abwesenheiten", label: "Abwesend", icon: CalendarX },
  { href: "/fahrer/profil", label: "Profil", icon: User },
]

export function DriverNav(): React.ReactElement {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary"
                  />
                )}
                <Icon
                  className="h-6 w-6"
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden="true"
                />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
