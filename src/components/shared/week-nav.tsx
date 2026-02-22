import Link from "next/link"
import { Button } from "@/components/ui/button"
import { addDays, formatWeekRange } from "@/lib/utils/dates"

interface WeekNavProps {
  weekStart: string
  basePath: "/rides" | "/dispatch"
  todayWeekStart: string
}

export function WeekNav({ weekStart, basePath, todayWeekStart }: WeekNavProps) {
  const prevWeek = addDays(weekStart, -7)
  const nextWeek = addDays(weekStart, 7)
  const isCurrentWeek = weekStart === todayWeekStart

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`${basePath}?week=${prevWeek}`}>
          &larr; Vorwoche
        </Link>
      </Button>
      <span className="min-w-[200px] px-3 text-center text-sm font-medium tabular-nums">
        {formatWeekRange(weekStart)}
      </span>
      <Button variant="outline" size="sm" asChild>
        <Link href={`${basePath}?week=${nextWeek}`}>
          Naechste Woche &rarr;
        </Link>
      </Button>
      {!isCurrentWeek && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={basePath}>Heute</Link>
        </Button>
      )}
    </div>
  )
}
