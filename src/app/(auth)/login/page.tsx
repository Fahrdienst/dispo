import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Anmelden - Fahrdienst",
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
      <LoginForm />
    </div>
  );
}
