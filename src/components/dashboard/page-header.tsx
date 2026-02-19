import Link from "next/link"
import { Button } from "@/components/ui/button"

interface PageHeaderProps {
  title: string
  description?: string
  createHref?: string
  createLabel?: string
}

export function PageHeader({
  title,
  description,
  createHref,
  createLabel,
}: PageHeaderProps) {
  return (
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
  )
}
