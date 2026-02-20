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
    <div className="space-y-2">
      {backHref && backLabel && (
        <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
          <Link href={backHref}>&larr; {backLabel}</Link>
        </Button>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
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
