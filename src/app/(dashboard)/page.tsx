import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - Dispo",
};

export default function DashboardPage(): React.ReactElement {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
      <p className="mt-2 text-gray-600">
        Willkommen in der Fahrdienst Disposition.
      </p>
    </div>
  );
}
