"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface SettingsNavItem {
  href: string
  label: string
}

const settingsNavItems: SettingsNavItem[] = [
  { href: "/settings/zones", label: "Zonen" },
  { href: "/settings/fares", label: "Tarife" },
  { href: "/settings/geocoding", label: "Geocoding" },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 rounded-lg border bg-muted p-1">
      {settingsNavItems.map((item) => {
        const isActive = pathname.startsWith(item.href)
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
