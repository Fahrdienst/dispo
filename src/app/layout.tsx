import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dispo - Fahrdienst Disposition",
  description:
    "Dispositionsanwendung fuer die Verwaltung von Fahrdienst-Transporten",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="de">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
