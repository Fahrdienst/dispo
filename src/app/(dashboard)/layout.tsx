import { redirect } from "next/navigation";
import { Activity, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { logout } from "@/actions/auth";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const auth = await requireAuth();

  if (!auth.authorized) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/40 bg-slate-900/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[var(--header-height)] max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="mr-2 flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm">
              <span className="text-xs font-bold text-slate-900">FD</span>
            </div>
            <div className="leading-none">
              <span className="block text-sm font-semibold tracking-tight text-white">Fahrdienst</span>
              <span className="block text-[11px] text-slate-300">Dispo Console</span>
            </div>
          </div>
          <DashboardNav role={auth.role} />
          <form action={logout} className="ml-auto">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="border border-white/15 text-slate-100 hover:border-white/35 hover:bg-white/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-cyan-200/70 bg-cyan-50/70 px-3 py-2 text-xs font-medium text-cyan-900">
          <Activity className="h-3.5 w-3.5" />
          Live-Dispositionsumgebung
        </div>
        {children}
      </main>
    </div>
  );
}
