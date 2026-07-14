import { Skeleton } from "@/components/ui/skeleton"

export default function DriverOverviewLoading(): React.ReactElement {
  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Next rides */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-36" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>

      {/* Quick tiles */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
