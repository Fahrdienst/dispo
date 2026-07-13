import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface HelpCardProps {
  href: string
  title: string
  description: string
  /** Optional leading icon (e.g. a lucide icon element). */
  icon?: React.ReactNode
  className?: string
}

/**
 * Large, high-contrast topic tile optimised for readability (60+ users):
 * generous padding, large tap target, clear affordance. Wraps a whole card
 * in a single link.
 */
export function HelpCard({
  href,
  title,
  description,
  icon,
  className,
}: HelpCardProps): React.ReactElement {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all",
        "hover:border-primary/40 hover:shadow-md",
        "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2",
        className
      )}
    >
      {icon && (
        <span
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 flex-1 text-base leading-relaxed text-slate-600">
        {description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-base font-medium text-primary">
        Öffnen
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  )
}
