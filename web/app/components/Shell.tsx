"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletProvider } from "@/lib/wallet";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/receivables", label: "Receivables" },
  { href: "/market", label: "Marketplace" },
  { href: "/create", label: "Register" },
  { href: "/docs", label: "The rules" },
];

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
      <defs>
        <mask id="ser-m">
          <rect width="64" height="64" fill="white" />
          {[0, 16, 32, 48, 64].map((x) => (
            <circle key={`t${x}`} cx={x} cy={0} r="4" fill="black" />
          ))}
          {[0, 16, 32, 48, 64].map((x) => (
            <circle key={`b${x}`} cx={x} cy={64} r="4" fill="black" />
          ))}
          {[16, 32, 48].map((y) => (
            <g key={`s${y}`}>
              <circle cx={0} cy={y} r="4" fill="black" />
              <circle cx={64} cy={y} r="4" fill="black" />
            </g>
          ))}
        </mask>
      </defs>
      <rect width="64" height="64" fill="var(--green)" mask="url(#ser-m)" />
      <rect x="9" y="9" width="46" height="46" fill="none" stroke="var(--paper)" strokeWidth="1.5" />
      <path d="M 22 18 L 44 18 L 44 24 L 29 24 L 29 30 L 40 30 L 40 36 L 29 36 L 29 46 L 22 46 Z" fill="var(--paper)" />
    </svg>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <WalletProvider>
      <header className="masthead">
        <div className="masthead-row">
          <Link href="/" className="wordmark">
            <Mark />
            Factora
          </Link>
          <nav>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-link${path?.startsWith(n.href) ? " on" : ""}`}
              >
                {n.label}
              </Link>
            ))}
            <WalletButton />
          </nav>
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="footer">
        <span>
          Factora — receivables judged financeable on GenLayer StudioNet.
        </span>
        <span className="v-mono">
          evidence committed · judgment under consensus · settlement by arithmetic
        </span>
      </footer>
    </WalletProvider>
  );
}
