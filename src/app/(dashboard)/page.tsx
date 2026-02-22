import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  AlertCircle,
  Car,
  CheckCircle2,
  BarChart3,
  Users,
  CalendarRange,
  CalendarCheck,
  Clock,
  Trophy,
  UserX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RideStatusBadge } from "@/components/shared/ride-status-badge";
import { DashboardMap } from "@/components/dashboard/dashboard-map";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Enums } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Dashboard - Dispo",
};

/* ---------- helpers ---------- */

/** Map JS day index (0=Sun) to our day_of_week enum. */
const JS_DAY_TO_ENUM: Record<number, Enums<"day_of_week">> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

import { getMondayOf, getSundayOf, addDays as addDaysUtil } from "@/lib/utils/dates";

function getCurrentWeekRange(today: string): { weekStart: string; weekEnd: string } {
  const weekStart = getMondayOf(today);
  return { weekStart, weekEnd: getSundayOf(today) };
}

function getNextWeekRange(today: string): { nextWeekStart: string; nextWeekEnd: string } {
  const thisMonday = getMondayOf(today);
  const nextWeekStart = addDaysUtil(thisMonday, 7);
  const nextWeekEnd = addDaysUtil(nextWeekStart, 6);
  return { nextWeekStart, nextWeekEnd };
}

/** Calculate first and last day of the previous month as ISO date strings. */
function getLastMonthRange(today: string): { lastMonthStart: string; lastMonthEnd: string } {
  const d = new Date(today + "T00:00:00");
  const firstOfThisMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastOfLastMonth = new Date(firstOfThisMonth);
  lastOfLastMonth.setDate(0);
  const firstOfLastMonth = new Date(
    lastOfLastMonth.getFullYear(),
    lastOfLastMonth.getMonth(),
    1
  );
  return {
    lastMonthStart: firstOfLastMonth.toISOString().split("T")[0]!,
    lastMonthEnd: lastOfLastMonth.toISOString().split("T")[0]!,
  };
}

/** Color class for the dropout rate percentage. */
function getDropoutRateColor(rate: number): string {
  if (rate > 10) return "text-red-600";
  if (rate > 5) return "text-amber-600";
  return "text-green-600";
}

/** Color class for the completion rate percentage. */
function getCompletionRateColor(rate: number): string {
  if (rate >= 90) return "text-green-600";
  if (rate >= 75) return "text-amber-600";
  return "text-red-600";
}

/** Format a date string as "Heute" or dd.MM. */
function formatDateShort(dateStr: string, today: string): string {
  if (dateStr === today) return "Heute";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
}

/* ---------- page ---------- */

export default async function DashboardPage() {
  const auth = await requireAuth();
  if (!auth.authorized) {
    redirect("/login");
  }
  if (auth.role === "driver") {
    redirect("/my/rides");
  }

  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0]!;
  const now = new Date().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const { weekStart, weekEnd } = getCurrentWeekRange(today);
  const { nextWeekStart, nextWeekEnd } = getNextWeekRange(today);
  const { lastMonthStart, lastMonthEnd } = getLastMonthRange(today);
  const firstOfCurrentMonth = (() => {
    const d = new Date(today + "T00:00:00");
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]!;
  })();
  const todayDayOfWeek = JS_DAY_TO_ENUM[new Date(today + "T00:00:00").getDay()];

  const TERMINAL_STATUSES = "(completed,cancelled,no_show)";

  const [
    // 0-5: daily stats
    totalRes,
    unplannedRes,
    activeRes,
    completedRes,
    upcomingRes,
    attentionRes,
    // 6-7: current week stats
    weekTotalRes,
    weekDropoutRes,
    // 8: planned but unconfirmed today
    plannedUnconfirmedRes,
    // 9-12: driver overview
    todayDriverIdsRes,
    allActiveDriversRes,
    weeklyAvailRes,
    dateAvailRes,
    // 13-14: next week stats
    nextWeekTotalRes,
    nextWeekUnplannedRes,
    // 15-17: last month stats
    lastMonthTotalRes,
    lastMonthCompletedRes,
    lastMonthDropoutRes,
    // 18-19: open rides + no-driver rides
    openRidesRes,
    noDriverRidesRes,
    // 20: driver ranking (completed rides this month)
    monthlyDriverRidesRes,
  ] = await Promise.all([
    /* 0 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .eq("is_active", true),
    /* 1 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .eq("status", "unplanned")
      .eq("is_active", true),
    /* 2 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .in("status", ["in_progress", "picked_up", "arrived"])
      .eq("is_active", true),
    /* 3 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .eq("status", "completed")
      .eq("is_active", true),
    /* 4 */ supabase
      .from("rides")
      .select("*, patients(first_name, last_name), destinations(display_name)")
      .eq("date", today)
      .not("status", "in", TERMINAL_STATUSES)
      .gte("pickup_time", now)
      .eq("is_active", true)
      .order("pickup_time")
      .limit(5),
    /* 5 */ supabase
      .from("rides")
      .select("*, patients(first_name, last_name), destinations(display_name)")
      .eq("date", today)
      .in("status", ["unplanned", "rejected"])
      .eq("is_active", true)
      .order("pickup_time"),
    /* 6 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .eq("is_active", true),
    /* 7 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .in("status", ["cancelled", "no_show"])
      .eq("is_active", true),
    /* 8 */ supabase
      .from("rides")
      .select("*, patients(first_name, last_name), destinations(display_name)")
      .eq("date", today)
      .eq("status", "planned")
      .eq("is_active", true)
      .order("pickup_time"),
    /* 9 */ supabase
      .from("rides")
      .select("driver_id")
      .eq("date", today)
      .eq("is_active", true)
      .not("driver_id", "is", null)
      .not("status", "in", "(cancelled,no_show)"),
    /* 10 */ supabase
      .from("drivers")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("last_name"),
    /* 11 */ todayDayOfWeek
      ? supabase
          .from("driver_availability")
          .select("driver_id")
          .eq("day_of_week", todayDayOfWeek)
          .is("specific_date", null)
      : Promise.resolve({ data: [] as { driver_id: string }[], error: null }),
    /* 12 */ supabase
      .from("driver_availability")
      .select("driver_id")
      .eq("specific_date", today),
    /* 13 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .gte("date", nextWeekStart)
      .lte("date", nextWeekEnd)
      .eq("is_active", true),
    /* 14 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .gte("date", nextWeekStart)
      .lte("date", nextWeekEnd)
      .eq("status", "unplanned")
      .eq("is_active", true),
    /* 15 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .gte("date", lastMonthStart)
      .lte("date", lastMonthEnd)
      .eq("is_active", true),
    /* 16 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .gte("date", lastMonthStart)
      .lte("date", lastMonthEnd)
      .eq("status", "completed")
      .eq("is_active", true),
    /* 17 */ supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .gte("date", lastMonthStart)
      .lte("date", lastMonthEnd)
      .in("status", ["cancelled", "no_show"])
      .eq("is_active", true),
    /* 18 */ supabase
      .from("rides")
      .select("*, patients(first_name, last_name), destinations(display_name)")
      .gte("date", today)
      .in("status", ["unplanned", "rejected"])
      .eq("is_active", true)
      .order("date")
      .order("pickup_time")
      .limit(15),
    /* 19 */ supabase
      .from("rides")
      .select("*, patients(first_name, last_name), destinations(display_name)")
      .gte("date", today)
      .is("driver_id", null)
      .not("status", "in", TERMINAL_STATUSES)
      .eq("is_active", true)
      .order("date")
      .order("pickup_time")
      .limit(15),
    /* 20 */ supabase
      .from("rides")
      .select("driver_id")
      .gte("date", firstOfCurrentMonth)
      .lte("date", today)
      .eq("status", "completed")
      .eq("is_active", true)
      .not("driver_id", "is", null),
  ]);

  /* ---------- process daily stats ---------- */

  const totalCount = totalRes.count ?? 0;
  const unplannedCount = unplannedRes.count ?? 0;
  const activeCount = activeRes.count ?? 0;
  const completedCount = completedRes.count ?? 0;
  const upcomingRides = upcomingRes.data ?? [];
  const attentionRides = attentionRes.data ?? [];

  // Current week
  const weekTotal = weekTotalRes.count ?? 0;
  const weekDropout = weekDropoutRes.count ?? 0;
  const dropoutRate = weekTotal > 0 ? (weekDropout / weekTotal) * 100 : 0;

  // Planned/unconfirmed rides
  const plannedUnconfirmedRides = plannedUnconfirmedRes.data ?? [];

  // Driver overview
  const activeDriversToday = new Set(
    (todayDriverIdsRes.data ?? []).map((r) => r.driver_id as string)
  );
  const allActiveDrivers = allActiveDriversRes.data ?? [];
  const totalDrivers = allActiveDrivers.length;
  const driversOnDuty = activeDriversToday.size;

  // Build set of available driver IDs (union of weekly + date-specific)
  const availableDriverIds = new Set<string>();
  for (const slot of weeklyAvailRes.data ?? []) {
    availableDriverIds.add(slot.driver_id);
  }
  for (const slot of dateAvailRes.data ?? []) {
    availableDriverIds.add(slot.driver_id);
  }

  // Drivers available but without a ride today
  const idleDrivers = allActiveDrivers.filter(
    (d) => availableDriverIds.has(d.id) && !activeDriversToday.has(d.id)
  );

  /* ---------- process new stats ---------- */

  // Next week
  const nextWeekTotal = nextWeekTotalRes.count ?? 0;
  const nextWeekUnplanned = nextWeekUnplannedRes.count ?? 0;

  // Last month
  const lastMonthTotal = lastMonthTotalRes.count ?? 0;
  const lastMonthCompleted = lastMonthCompletedRes.count ?? 0;
  const lastMonthDropout = lastMonthDropoutRes.count ?? 0;
  const lastMonthCompletionRate =
    lastMonthTotal > 0 ? (lastMonthCompleted / lastMonthTotal) * 100 : 0;
  const lastMonthDropoutRate =
    lastMonthTotal > 0 ? (lastMonthDropout / lastMonthTotal) * 100 : 0;

  // Open rides + no-driver rides
  const allOpenRides = openRidesRes.data ?? [];
  const noDriverRides = noDriverRidesRes.data ?? [];

  // Driver ranking: aggregate completed rides this month per driver
  const driverRideCountMap = new Map<string, number>();
  for (const row of monthlyDriverRidesRes.data ?? []) {
    const driverId = row.driver_id as string;
    driverRideCountMap.set(driverId, (driverRideCountMap.get(driverId) ?? 0) + 1);
  }

  const driverRanking = allActiveDrivers
    .map((d) => ({
      id: d.id,
      name: `${d.last_name}, ${d.first_name}`,
      rideCount: driverRideCountMap.get(d.id) ?? 0,
    }))
    .filter((d) => d.rideCount > 0)
    .sort((a, b) => b.rideCount - a.rideCount)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {/* ---- Row 1: Daily Stats Cards ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Heute gesamt
            </CardTitle>
            <div className="rounded-md bg-blue-100 p-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCount}</p>
          </CardContent>
        </Card>

        <Card className={cn(unplannedCount > 0 && "border-red-200 bg-red-50/40")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ungeplant
            </CardTitle>
            <div
              className={cn(
                "rounded-md p-2",
                unplannedCount > 0 ? "bg-red-100" : "bg-gray-100"
              )}
            >
              <AlertCircle
                className={cn(
                  "h-4 w-4",
                  unplannedCount > 0 ? "text-red-600" : "text-gray-500"
                )}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-3xl font-bold",
                unplannedCount > 0 && "text-red-600"
              )}
            >
              {unplannedCount}
            </p>
            {unplannedCount > 0 && (
              <p className="mt-1 text-xs font-medium text-red-600">Sofort handeln</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktive Fahrten
            </CardTitle>
            <div className="rounded-md bg-emerald-100 p-2">
              <Car className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Abgeschlossen
            </CardTitle>
            <div className="rounded-md bg-green-100 p-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Row 2: Overview Cards (4-col) ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Diese Woche */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Diese Woche
            </CardTitle>
            <div className="rounded-md bg-violet-100 p-2">
              <BarChart3 className="h-4 w-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{weekTotal}</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">Ausfallquote</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  getDropoutRateColor(dropoutRate)
                )}
              >
                {dropoutRate.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Naechste Woche */}
        <Card
          className={cn(nextWeekUnplanned > 0 && "border-amber-200 bg-amber-50/40")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Naechste Woche
            </CardTitle>
            <div className="rounded-md bg-indigo-100 p-2">
              <CalendarRange className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{nextWeekTotal}</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">Ungeplant</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  nextWeekUnplanned > 0 ? "text-amber-600" : "text-green-600"
                )}
              >
                {nextWeekUnplanned}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Letzter Monat */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Letzter Monat
            </CardTitle>
            <div className="rounded-md bg-cyan-100 p-2">
              <CalendarCheck className="h-4 w-4 text-cyan-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{lastMonthTotal}</p>
            <div className="mt-1 flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-muted-foreground">Abschluss</span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    getCompletionRateColor(lastMonthCompletionRate)
                  )}
                >
                  {lastMonthCompletionRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-muted-foreground">Ausfall</span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    getDropoutRateColor(lastMonthDropoutRate)
                  )}
                >
                  {lastMonthDropoutRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fahrer heute */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fahrer heute
            </CardTitle>
            <div className="rounded-md bg-amber-100 p-2">
              <Users className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {driversOnDuty}
              <span className="text-lg font-normal text-muted-foreground">
                /{totalDrivers}
              </span>
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">Verfuegbar ohne Fahrt</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  idleDrivers.length > 0 ? "text-amber-600" : "text-muted-foreground"
                )}
              >
                {idleDrivers.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Idle drivers banner */}
      {idleDrivers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <UserX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Verfuegbare Fahrer ohne Fahrt
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {idleDrivers.map((driver) => (
                    <Link
                      key={driver.id}
                      href={`/drivers/${driver.id}`}
                      className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200"
                    >
                      {driver.last_name}, {driver.first_name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Row 3: Upcoming Rides + Attention Required ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Rides */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Naechste Fahrten</CardTitle>
              <Link href="/rides" className="text-sm text-muted-foreground hover:underline">
                Alle anzeigen
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingRides.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine anstehenden Fahrten.</p>
            ) : (
              <div className="space-y-3">
                {upcomingRides.map((ride) => {
                  const patient = ride.patients as { first_name: string; last_name: string } | null;
                  const destination = ride.destinations as { display_name: string } | null;
                  return (
                    <Link
                      key={ride.id}
                      href={`/rides/${ride.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium tabular-nums">
                          {ride.pickup_time.slice(0, 5)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {patient ? `${patient.last_name}, ${patient.first_name}` : "\u2013"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {destination?.display_name ?? "\u2013"}
                          </p>
                        </div>
                      </div>
                      <RideStatusBadge status={ride.status as Enums<"ride_status">} />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attention Required */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Handlungsbedarf</CardTitle>
              <Link href="/rides" className="text-sm text-muted-foreground hover:underline">
                Alle anzeigen
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {attentionRides.length === 0 && plannedUnconfirmedRides.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Aufgaben.</p>
            ) : (
              <div className="space-y-3">
                {attentionRides.map((ride) => {
                  const patient = ride.patients as { first_name: string; last_name: string } | null;
                  const destination = ride.destinations as { display_name: string } | null;
                  const borderColor =
                    ride.status === "unplanned"
                      ? "border-l-4 border-l-red-500"
                      : "border-l-4 border-l-orange-500";
                  return (
                    <Link
                      key={ride.id}
                      href={`/rides/${ride.id}`}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
                        borderColor
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium tabular-nums">
                          {ride.pickup_time.slice(0, 5)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {patient ? `${patient.last_name}, ${patient.first_name}` : "\u2013"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {destination?.display_name ?? "\u2013"}
                          </p>
                        </div>
                      </div>
                      <RideStatusBadge status={ride.status as Enums<"ride_status">} />
                    </Link>
                  );
                })}
                {plannedUnconfirmedRides.map((ride) => {
                  const patient = ride.patients as { first_name: string; last_name: string } | null;
                  const destination = ride.destinations as { display_name: string } | null;
                  return (
                    <Link
                      key={ride.id}
                      href={`/rides/${ride.id}`}
                      className="flex items-center justify-between rounded-lg border border-l-4 border-l-amber-400 p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium tabular-nums">
                          {ride.pickup_time.slice(0, 5)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {patient ? `${patient.last_name}, ${patient.first_name}` : "\u2013"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {destination?.display_name ?? "\u2013"}
                          </p>
                        </div>
                      </div>
                      <RideStatusBadge status={ride.status as Enums<"ride_status">} />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Row 4: Open Rides + Rides Without Driver ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Open Rides (all dates) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <CardTitle>Offene Fahrten</CardTitle>
              </div>
              <Link href="/rides" className="text-sm text-muted-foreground hover:underline">
                Alle anzeigen
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {allOpenRides.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Fahrten.</p>
            ) : (
              <div className="space-y-2">
                {allOpenRides.map((ride) => {
                  const patient = ride.patients as { first_name: string; last_name: string } | null;
                  const destination = ride.destinations as { display_name: string } | null;
                  return (
                    <Link
                      key={ride.id}
                      href={`/rides/${ride.id}`}
                      className="flex items-center justify-between rounded-lg border border-l-4 border-l-red-500 p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">
                            {formatDateShort(ride.date, today)}
                          </span>
                          <span className="text-sm font-medium tabular-nums">
                            {ride.pickup_time.slice(0, 5)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {patient ? `${patient.last_name}, ${patient.first_name}` : "\u2013"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {destination?.display_name ?? "\u2013"}
                          </p>
                        </div>
                      </div>
                      <RideStatusBadge status={ride.status as Enums<"ride_status">} />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rides Without Driver */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <CardTitle>Fahrten ohne Fahrer</CardTitle>
              </div>
              <Link href="/rides" className="text-sm text-muted-foreground hover:underline">
                Alle anzeigen
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {noDriverRides.length === 0 ? (
              <p className="text-sm text-muted-foreground">Alle Fahrten haben einen Fahrer.</p>
            ) : (
              <div className="space-y-2">
                {noDriverRides.map((ride) => {
                  const patient = ride.patients as { first_name: string; last_name: string } | null;
                  const destination = ride.destinations as { display_name: string } | null;
                  return (
                    <Link
                      key={ride.id}
                      href={`/rides/${ride.id}`}
                      className="flex items-center justify-between rounded-lg border border-l-4 border-l-orange-500 p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">
                            {formatDateShort(ride.date, today)}
                          </span>
                          <span className="text-sm font-medium tabular-nums">
                            {ride.pickup_time.slice(0, 5)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {patient ? `${patient.last_name}, ${patient.first_name}` : "\u2013"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {destination?.display_name ?? "\u2013"}
                          </p>
                        </div>
                      </div>
                      <RideStatusBadge status={ride.status as Enums<"ride_status">} />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Row 5: Driver Ranking ---- */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <CardTitle>Fahrer-Ranking</CardTitle>
            <span className="text-sm font-normal text-muted-foreground">
              Top 10 abgeschlossene Fahrten diesen Monat
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {driverRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine abgeschlossenen Fahrten diesen Monat.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Fahrer</TableHead>
                  <TableHead className="text-right">Fahrten</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driverRanking.map((entry, index) => (
                  <TableRow key={entry.id}>
                    <TableCell className="tabular-nums font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/drivers/${entry.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {entry.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {entry.rideCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ---- Row 6: Map ---- */}
      <Suspense
        fallback={
          <Skeleton className="h-[280px] w-full rounded-lg sm:h-[400px]" />
        }
      >
        <DashboardMap />
      </Suspense>
    </div>
  );
}
