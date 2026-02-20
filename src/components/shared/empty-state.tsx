import Link from "next/link"
import { PackageOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  message: string
  icon?: React.ReactNode
  createHref?: string
  createLabel?: string
}

export function EmptyState({ message, icon, createHref, createLabel }: EmptyStateProps) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
      <div className="rounded-full bg-muted p-3">
        {icon ?? <PackageOpen className="h-6 w-6 text-muted-foreground" />}
      </div>
      <p className="text-muted-foreground">{message}</p>
      {createHref && createLabel && (
        <Button size="sm" asChild>
          <Link href={createHref}>{createLabel}</Link>
        </Button>
      )}
    </div>
  )
}
