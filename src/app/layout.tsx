import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Dispo | Fahrdienst Disposition",
  description:
    "Dispositionsanwendung für die Verwaltung von Fahrdienst-Transporten",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="de">
      <body className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
