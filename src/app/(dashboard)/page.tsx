import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  AlertCircle,
  Car,
  CheckCircle2,
  BarChart3,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RideStatusBadge } from "@/components/shared/ride-status-badge";
import { cn } from "@/lib/utils";
import type { Enums } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Dashboard - Dispo",
};

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

/** Calculate Monday (start) and Sunday (end) of the current week as ISO date strings. */
function getCurrentWeekRange(today: string): { weekStart: string; weekEnd: string } {
  const d = new Date(today + "T00:00:00");
  const jsDay = d.getDay(); // 0=Sun
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().split("T")[0]!,
    weekEnd: sunday.toISOString().split("T")[0]!,
  };
}

/** Color class for the dropout rate percentage. */
function getDropoutRateColor(rate: number): string {
  if (rate > 10) return "text-red-600";
  if (rate > 5) return "text-amber-600";
  return "text-green-600";
}

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
  const todayDayOfWeek = JS_DAY_TO_ENUM[new Date(today + "T00:00:00").getDay()];

  const [
    totalRes,
    unplannedRes,
    activeRes,
    completedRes,
    upcomingRes,
    attentionRes,
    weekTotalRes,
    weekDropoutRes,
    plannedUnconfirmedRes,
    todayDriverIdsRes,
    allActiveDriversRes,
    weeklyAvailRes,
    dateAvailRes,
  ] = await Promise.all([
    // -- Existing daily stats --
    supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .eq("is_active", true),
    supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .eq("status", "unplanned")
      .eq("is_active", true),
    supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .in("status", ["in_progress", "picked_up", "arrived"])
      .eq("is_active", true),
    supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .eq("status", "completed")
      .eq("is_active", true),
    supabase
      .from("rides")
      .select("*, patients(first_name, last_name), destinations(display_name)")
      .eq("date", today)
      .not("status", "in", "(completed,cancelled,no_show)")
      .gte("pickup_time", now)
      .eq("is_active", true)
      .order("pickup_time")
      .limit(5),
    supabase
      .from("rides")
      .select("*, patients(first_name, last_name), destinations(display_name)")
      .eq("date", today)
      .in("status", ["unplanned", "rejected"])
      .eq("is_active", true)
      .order("pickup_time"),

    // -- Week statistics --
    supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .eq("is_active", true),
    supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .in("status", ["cancelled", "no_show"])
      .eq("is_active", true),

    // -- Planned but not confirmed (open task) --
    supabase
      .from("rides")
      .select("*, patients(first_name, last_name), destinations(display_name)")
      .eq("date", today)
      .eq("status", "planned")
      .eq("is_active", true)
      .order("pickup_time"),

    // -- Drivers with rides today (distinct driver_id) --
    supabase
      .from("rides")
      .select("driver_id")
      .eq("date", today)
      .eq("is_active", true)
      .not("driver_id", "is", null)
      .not("status", "in", "(cancelled,no_show)"),

    // -- All active drivers --
    supabase
      .from("drivers")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("last_name"),

    // -- Weekly availability for today's day of week --
    todayDayOfWeek
      ? supabase
          .from("driver_availability")
          .select("driver_id")
          .eq("day_of_week", todayDayOfWeek)
          .is("specific_date", null)
      : Promise.resolve({ data: [] as { driver_id: string }[], error: null }),

    // -- Date-specific availability for today --
    supabase
      .from("driver_availability")
      .select("driver_id")
      .eq("specific_date", today),
  ]);

  // -- Process existing stats --
  const totalCount = totalRes.count ?? 0;
  const unplannedCount = unplannedRes.count ?? 0;
  const activeCount = activeRes.count ?? 0;
  const completedCount = completedRes.count ?? 0;
  const upcomingRides = upcomingRes.data ?? [];
  const attentionRides = attentionRes.data ?? [];

  // -- Week statistics --
  const weekTotal = weekTotalRes.count ?? 0;
  const weekDropout = weekDropoutRes.count ?? 0;
  const dropoutRate = weekTotal > 0 ? (weekDropout / weekTotal) * 100 : 0;

  // -- Planned/unconfirmed rides --
  const plannedUnconfirmedRides = plannedUnconfirmedRes.data ?? [];

  // -- Driver overview --
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {/* Daily Stats Cards */}
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
            <div className={cn("rounded-md p-2", unplannedCount > 0 ? "bg-red-100" : "bg-gray-100")}>
              <AlertCircle className={cn("h-4 w-4", unplannedCount > 0 ? "text-red-600" : "text-gray-500")} />
            </div>
          </CardHeader>
          <CardContent>
            <p className={cn("text-3xl font-bold", unplannedCount > 0 && "text-red-600")}>
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

      {/* Week Statistics + Driver Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Week Statistics */}
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
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Gesamtfahrten</span>
                <span className="text-2xl font-bold tabular-nums">{weekTotal}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Ausgefallen</span>
                <span className="text-2xl font-bold tabular-nums">{weekDropout}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Ausfallquote</span>
                  <span
                    className={`text-2xl font-bold tabular-nums ${getDropoutRateColor(dropoutRate)}`}
                  >
                    {dropoutRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Overview */}
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
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Im Einsatz</span>
                <span className="text-2xl font-bold tabular-nums">{driversOnDuty}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Verfuegbar ohne Fahrt</span>
                <span
                  className={`text-2xl font-bold tabular-nums ${idleDrivers.length > 0 ? "text-amber-600" : ""}`}
                >
                  {idleDrivers.length}
                </span>
              </div>
              <div className="border-t pt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Gesamt aktiv</span>
                  <span className="text-2xl font-bold tabular-nums">{totalDrivers}</span>
                </div>
              </div>
              {idleDrivers.length > 0 && (
                <div className="border-t pt-2">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Verfuegbar ohne Fahrt:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {idleDrivers.map((driver) => (
                      <span
                        key={driver.id}
                        className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                      >
                        {driver.last_name}, {driver.first_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-column section: Upcoming Rides + Attention Required */}
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
                      className={`flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 ${borderColor}`}
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
    </div>
  );
}
