import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { AppOverlays } from "@/components/shared/app-overlays";
import { logout } from "@/actions/auth";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const auth = await requireAuth();

  if (!auth.authorized) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", auth.userId)
    .single();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <DashboardSidebar role={auth.role} logoutAction={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <AppOverlays userEmail={profile?.email ?? undefined} />
    </div>
  );
}
