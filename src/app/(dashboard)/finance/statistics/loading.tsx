export default function FinanceStatisticsLoading(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Dimension selector */}
      <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />

      {/* Period controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="h-14 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 w-72 animate-pulse rounded-lg bg-muted" />
        <div className="ml-auto h-16 w-40 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Table rows */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}
