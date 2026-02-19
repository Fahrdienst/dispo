import { DashboardNav } from "@/components/dashboard/dashboard-nav";

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
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
