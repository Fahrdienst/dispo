import Link from "next/link"
import { Button } from "@/components/ui/button"

interface PageHeaderProps {
  title: string
  description?: string
  createHref?: string
  createLabel?: string
  backHref?: string
  backLabel?: string
}

export function PageHeader({
  title,
  description,
  createHref,
  createLabel,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <div className="glass-panel space-y-3 rounded-2xl p-5 sm:p-6">
      {backHref && backLabel && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          asChild
        >
          <Link href={backHref}>&larr; {backLabel}</Link>
        </Button>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {createHref && createLabel && (
          <Button asChild>
            <Link href={createHref}>{createLabel}</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
