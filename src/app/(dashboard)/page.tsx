import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RideStatusBadge } from "@/components/shared/ride-status-badge";
import type { Enums } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Dashboard - Dispo",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0]!;
  const now = new Date().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const [totalRes, unplannedRes, activeRes, completedRes, upcomingRes, attentionRes] =
    await Promise.all([
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
    ]);

  const totalCount = totalRes.count ?? 0;
  const unplannedCount = unplannedRes.count ?? 0;
  const activeCount = activeRes.count ?? 0;
  const completedCount = completedRes.count ?? 0;
  const upcomingRides = upcomingRes.data ?? [];
  const attentionRides = attentionRes.data ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Heute gesamt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ungeplant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${unplannedCount > 0 ? "text-red-600" : ""}`}>
              {unplannedCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktive Fahrten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Abgeschlossen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Rides */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Nächste Fahrten</CardTitle>
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
                    <div
                      key={ride.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium tabular-nums">
                          {ride.pickup_time.slice(0, 5)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {patient ? `${patient.last_name}, ${patient.first_name}` : "–"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {destination?.display_name ?? "–"}
                          </p>
                        </div>
                      </div>
                      <RideStatusBadge status={ride.status as Enums<"ride_status">} />
                    </div>
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
            {attentionRides.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Fahrten.</p>
            ) : (
              <div className="space-y-3">
                {attentionRides.map((ride) => {
                  const patient = ride.patients as { first_name: string; last_name: string } | null;
                  const destination = ride.destinations as { display_name: string } | null;
                  return (
                    <div
                      key={ride.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {patient ? `${patient.last_name}, ${patient.first_name}` : "–"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {destination?.display_name ?? "–"}
                        </p>
                      </div>
                      <RideStatusBadge status={ride.status as Enums<"ride_status">} />
                    </div>
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
