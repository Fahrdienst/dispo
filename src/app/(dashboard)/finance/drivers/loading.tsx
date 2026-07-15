export default function FinanceDriversLoading(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Period navigation */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        <div className="h-5 w-44 animate-pulse rounded bg-muted" />
        <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        <div className="h-9 w-36 animate-pulse rounded bg-muted" />
        <div className="ml-auto h-9 w-28 animate-pulse rounded bg-muted" />
      </div>

      {/* Free range */}
      <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />

      {/* Rates bar */}
      <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />

      {/* Table rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}
