interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}
