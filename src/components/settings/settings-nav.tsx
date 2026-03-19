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
  { href: "/settings/zones/map", label: "Zonenkarte" },
  { href: "/settings/fares", label: "Tarife" },
  { href: "/settings/geocoding", label: "Geocoding" },
  { href: "/settings/organization", label: "Organisation" },
  { href: "/settings/system", label: "System" },
  { href: "/settings/security", label: "Sicherheit" },
]

export function SettingsNav() {
  const pathname = usePathname()

  // Find the longest matching href so "/settings/zones/map" wins over "/settings/zones"
  const activeHref = settingsNavItems
    .filter((item) => pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1">
      {settingsNavItems.map((item) => {
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
