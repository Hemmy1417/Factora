"use client";

/** The cover: one headline, one live widget, one strip. Everything else
 * lives where it is used — the rules page explains, the rooms act. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { getStats } from "@/lib/read";
import type { Stats } from "@/lib/types";
import { formatGen } from "@/lib/config";

const STEPS = ["Register", "Commit", "Judge", "Window", "Fund", "Repay", "Settle"];

export default function Landing() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let alive = true;
    void getStats().then((s) => { if (alive) setStats(s); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="stack" style={{ gap: 72 }}>
      <div className="grid-2" style={{ alignItems: "center", gap: 40, marginTop: 32 }}>
        <div className="stack" style={{ gap: 28 }}>
          <span className="section-no" style={{ color: "var(--lime)", justifySelf: "start" }}>
            RECEIVABLES FINANCE · GENLAYER STUDIONET
          </span>
          <h1 className="v-display" style={{
            fontSize: "clamp(42px, 5.6vw, 82px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.02,
          }}>
            An invoice is worth what its evidence can prove.
          </h1>
          <p className="v-body" style={{ fontSize: 18, margin: 0 }}>
            Evidence on-chain. A validator panel judges it. Code moves the money.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/create" className="btn" style={{ textDecoration: "none" }}>
              Register a receivable
            </Link>
            <Link href="/market" className="btn btn-quiet" style={{ textDecoration: "none" }}>
              Marketplace
            </Link>
            <Link href="/docs" className="arrow-cta" aria-label="Read the rules"
              style={{ textDecoration: "none" }}>
              →
            </Link>
          </div>
        </div>

        <div className="tile" style={{ padding: 32, gap: 20 }}>
          <span className="v-label">The protocol, live</span>
          <div className="tile-strip" style={{ gap: 12 }}>
            <div>
              <div className="big">{stats ? stats.invoices : "—"}</div>
              <div className="sub">receivables</div>
            </div>
            <div>
              <div className="big">{stats ? stats.funded : "—"}</div>
              <div className="sub">funded</div>
            </div>
            <div>
              <div className="big">{stats ? formatGen(stats.escrow_atto) : "—"}</div>
              <div className="sub">GEN in custody</div>
            </div>
          </div>
          <div className="step-flow" style={{ marginTop: 8 }}>
            {STEPS.map((s, i) => (
              <span key={s} style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                {i > 0 ? <span className="step-arrow">→</span> : null}
                <span className="step-chip">{s}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-3">
        <div className="tile">
          <span className="v-label">Commit</span>
          <div className="big" style={{ fontSize: 22 }}>Evidence becomes bytes</div>
          <div className="sub">
            Hashed, frozen, append-only — and the buyer&apos;s wallet can
            countersign it.
          </div>
        </div>
        <div className="tile">
          <span className="v-label">Judge</span>
          <div className="big" style={{ fontSize: 22 }}>A panel, not a feed</div>
          <div className="sub">
            Validators judge the evidence; code derives the decision, the
            risk, and every term.
          </div>
        </div>
        <div className="tile">
          <span className="v-label">Settle</span>
          <div className="big" style={{ fontSize: 22 }}>Money is arithmetic</div>
          <div className="sub">
            Exact advances, a conserving split, custody that drains to zero.
          </div>
        </div>
      </div>
    </div>
  );
}
