import { Skeleton } from "@/components/ui/skeleton"

export default function DriverAvailabilityLoading(): React.ReactElement {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      <Skeleton className="h-12 w-full rounded-lg" />

      {/* Weekly grid: five day cards */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <Skeleton className="h-5 w-24" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Exceptions block */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  )
}
