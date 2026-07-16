export default function FinanceDashboardLoading(): React.ReactElement {
  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="space-y-3">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 w-full animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="h-52 w-full animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-52 w-full animate-pulse rounded-2xl bg-muted" />
          <div className="h-52 w-full animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>

      {/* Top lists + receipts */}
      <div className="space-y-4">
        <div className="h-5 w-56 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 w-full animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}
