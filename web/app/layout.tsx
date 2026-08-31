import type { Metadata } from "next";
import { Inter_Tight, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "./components/Shell";

// Single weight, deliberately: hierarchy in this system is size and
// tracking, never boldness. Inter Tight is the Aspekta substitute the
// reference names; Roboto Mono is the lab-notebook voice.
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-aspekta",
  weight: ["400"],
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  weight: ["400"],
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
    // The font variables ride the <html> element: the design tokens that
    // reference them (--sans, --mono) are declared on :root, and a custom
    // property resolves its inner var() where IT is declared - on <body>
    // the variables would exist one element too low and every font token
    // would compute to guaranteed-invalid.
    <html lang="en" className={`${interTight.variable} ${robotoMono.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
