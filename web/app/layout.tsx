import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "./components/Shell";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Factora · receivables, judged financeable",
  description:
    "Invoice factoring where a GenLayer validator panel judges the evidence " +
    "behind a receivable, and deterministic contract code moves the money.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
