import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { logout } from "@/actions/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b bg-white">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold">Fahrdienst</h1>
          <DashboardNav />
          <form action={logout} className="ml-auto">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
