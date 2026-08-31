"use client";

/** The cover: a dark laboratory band — headline left, the live protocol
 * right, and everything below scannable: tiles, chips, steps. No walls of
 * prose, no raw blocks. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { getStats } from "@/lib/read";
import type { Stats } from "@/lib/types";
import { formatGen } from "@/lib/config";

const STEPS = ["Register", "Commit evidence", "Panel judges", "Window", "Fund", "Repay", "Settle"];

export default function Landing() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let alive = true;
    void getStats().then((s) => { if (alive) setStats(s); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="stack" style={{ gap: 0 }}>
      {/* hero: headline + the live protocol as a widget */}
      <div className="grid-2" style={{ alignItems: "center", gap: 40, marginTop: 24 }}>
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
            Commit the evidence on-chain. A validator panel judges it under
            consensus. Deterministic code moves the money.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/create" className="btn" style={{ textDecoration: "none" }}>
              Register a receivable
            </Link>
            <Link href="/market" className="btn btn-quiet" style={{ textDecoration: "none" }}>
              Marketplace
            </Link>
            <Link href="/market" className="arrow-cta" aria-label="Open the marketplace"
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
              <div className="sub">receivables judged or in flight</div>
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

      {/* three personas, one line each */}
      <div className="section-head">
        <span className="section-no">01</span>
        <h2>Three wallets, one record</h2>
      </div>
      <div className="grid-3">
        <div className="action-card">
          <span className="v-label">The seller</span>
          <h3>Unlock the invoice</h3>
          <p>
            Register, commit the evidence as frozen bytes, put it to the
            panel. Financeable terms come from a code table.
          </p>
          <Link href="/create" className="btn btn-quiet" style={{ textDecoration: "none", textAlign: "center" }}>
            Register
          </Link>
        </div>
        <div className="action-card">
          <span className="v-label">The buyer&apos;s wallet</span>
          <h3>Countersign or dispute</h3>
          <p>
            The one identity fact a seller cannot manufacture. An
            unacknowledged record caps the advance in code; a dispute blocks
            financeable outright.
          </p>
          <Link href="/receivables" className="btn btn-quiet" style={{ textDecoration: "none", textAlign: "center" }}>
            Find your invoice
          </Link>
        </div>
        <div className="action-card">
          <span className="v-label">The capital provider</span>
          <h3>Fund what was proven</h3>
          <p>
            Inspect the evidence graph, deposit the exact derived advance,
            and take principal plus the fee from the repayment split.
          </p>
          <Link href="/market" className="btn btn-quiet" style={{ textDecoration: "none", textAlign: "center" }}>
            Browse the marketplace
          </Link>
        </div>
      </div>

      {/* the judgment, in tiles instead of paragraphs */}
      <div className="section-head">
        <span className="section-no">02</span>
        <h2>A panel, not a price feed</h2>
      </div>
      <div className="tile-strip">
        <div className="tile">
          <span className="v-label">The model judges</span>
          <div className="big" style={{ fontSize: 24 }}>Three pillars</div>
          <div className="sub">
            seller · buyer · transaction — plus conflicts, and exactly which
            evidence it examined
          </div>
        </div>
        <div className="tile">
          <span className="v-label">Code composes</span>
          <div className="big" style={{ fontSize: 24 }}>Decision &amp; risk</div>
          <div className="sub">
            derived identically inside every validator — the model never
            names a term, a rate, or a payout
          </div>
        </div>
        <div className="tile">
          <span className="v-label">Then a window</span>
          <div className="big" style={{ fontSize: 24 }}>Challengeable</div>
          <div className="sub">
            every verdict waits out a bonded challenge window before a single
            atto moves
          </div>
        </div>
      </div>

      {/* trust model — the light band, tightened */}
      <div className="section-head">
        <span className="section-no">03</span>
        <h2>What the panel is told about trust</h2>
      </div>
      <div className="band-light" style={{ borderRadius: 40, padding: 40 }}>
        <div className="grid-2">
          <div className="sheet" style={{ padding: 32 }}>
            <div className="stamp tone-good">contract-verified</div>
            <p className="v-body" style={{ fontSize: 15, marginTop: 12, marginBottom: 0 }}>
              The buyer&apos;s on-chain acknowledgement and dispute — signed
              by the buyer&apos;s own wallet — and every page the contract
              fetches itself, under consensus.
            </p>
          </div>
          <div className="sheet" style={{ padding: 32 }}>
            <div className="stamp tone-neutral">party-declared</div>
            <p className="v-body" style={{ fontSize: 15, marginTop: 12, marginBottom: 0 }}>
              Every committed document — hashed, frozen, tamper-evident, and
              still a claim. The panel weighs it as one, and a record without
              the countersignature caps the advance in code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
