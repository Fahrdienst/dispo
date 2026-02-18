import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Anmelden - Dispo",
};

export default function LoginPage(): React.ReactElement {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Anmelden</h1>
        <p className="mt-2 text-sm text-gray-600">
          Melden Sie sich mit Ihrem Konto an
        </p>
      </div>
      <div className="text-center text-sm text-gray-500">
        <p>Anmeldeformular wird hier implementiert.</p>
      </div>
    </div>
  );
}
