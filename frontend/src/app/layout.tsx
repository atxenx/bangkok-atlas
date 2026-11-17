import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Bangkok Atlas — Explore Neighborhoods in Bangkok",
  description:
    "Explore Bangkok neighborhoods through transit, everyday amenities, surroundings, and clearly labelled price estimates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
