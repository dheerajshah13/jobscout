import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobScout - Ranked Jobs in Germany",
  description: "A Germany-focused job feed that aggregates, deduplicates, and ranks listings against your profile."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
