"use client";

/** The funding marketplace: financeable receivables a capital provider can
 * inspect and fund. Everything shown is authoritative state; the evidence
 * graph is one click away because nobody should fund a number. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { getInvoices, getStats } from "@/lib/read";
import type { Invoice, Stats } from "@/lib/types";
import { formatBps, formatGen, formatSpan } from "@/lib/config";
import { RISK_LABEL } from "@/lib/taxonomy";

export default function MarketPage() {
  const [open, setOpen] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        // One bounded page of the newest instruments; the marketplace shows
        // the financeable slice of it.
        const page = await getInvoices(0, 50, true);
        const s = await getStats(true);
        if (!alive) return;
        setOpen(page.invoices.filter(
          (v) => v.status === "FINANCEABLE" && !v.challenge_open));
        setStats(s);
        setNow(Math.floor(Date.now() / 1000));
        setProblem("");
      } catch (e) {
        if (alive) setProblem(e instanceof Error ? e.message : "The chain could not be read.");
      }
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div>
      <h1 className="v-display" style={{ fontSize: 34 }}>Funding marketplace</h1>
      <p className="v-body" style={{ marginTop: 8 }}>
        Receivables a validator panel has judged financeable, with their
        verdicts final and their windows lapsed. The advance and the fee are
        table-derived from the pinned risk class — inspect the evidence graph
        before you fund; that is what it is for.
      </p>
      {problem ? <p className="note bad">{problem}</p> : null}

      {stats ? (
        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="sheet-recessed">
            <div className="v-label">Instruments registered</div>
            <div className="v-figure" style={{ fontSize: 26 }}>{stats.invoices}</div>
          </div>
          <div className="sheet-recessed">
            <div className="v-label">Funded</div>
            <div className="v-figure" style={{ fontSize: 26 }}>{stats.funded}</div>
          </div>
          <div className="sheet-recessed">
            <div className="v-label">In custody</div>
            <div className="v-figure" style={{ fontSize: 26 }}>
              {formatGen(stats.escrow_atto)} GEN
            </div>
          </div>
        </div>
      ) : null}

      <div className="section-head">
        <span className="section-no">01</span>
        <h2>Open for funding</h2>
      </div>
      {open.length === 0 ? (
        <p className="v-body">
          Nothing is open for funding right now. A receivable appears here
          when its verdict is FINANCEABLE, final, and inside its funding
          window.
        </p>
      ) : (
        <div className="grid-2">
          {open.map((v) => {
            const advance = BigInt(v.advance_atto);
            return (
              <Link key={v.invoice_id} href={`/receivables/${v.invoice_id}`}
                className="sheet" style={{ textDecoration: "none", display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span className="v-mono" style={{ color: "var(--lime)" }}>
                    {v.invoice_id}
                  </span>
                  <span className="v-figure" style={{ fontSize: 24 }}>
                    {formatGen(v.amount_atto)} GEN
                  </span>
                  <span className="stamp tone-neutral" style={{ marginLeft: "auto" }}>
                    {RISK_LABEL[v.risk] ?? v.risk}
                  </span>
                </div>
                <dl className="defs">
                  <div className="def-row">
                    <dt>Advance to deposit</dt>
                    <dd className="v-figure">
                      {formatGen(advance)} GEN ({formatBps(v.advance_rate_bps)})
                    </dd>
                  </div>
                  <div className="def-row">
                    <dt>Factoring fee on repayment</dt>
                    <dd className="v-figure">{formatBps(v.fee_bps)}</dd>
                  </div>
                  <div className="def-row">
                    <dt>Due</dt>
                    <dd>{formatSpan(v.due_epoch - now)} from now</dd>
                  </div>
                  <div className="def-row">
                    <dt>Funding window</dt>
                    <dd>{formatSpan(v.funding_deadline_epoch - now)} left</dd>
                  </div>
                  <div className="def-row">
                    <dt>Obligation</dt>
                    <dd>{v.buyer_ack_epoch ? "countersigned by the buyer" : "declared only (advance capped)"}</dd>
                  </div>
                  <div className="def-row">
                    <dt>Score</dt>
                    <dd className="v-figure">{v.score} / 100</dd>
                  </div>
                </dl>
                <span className="v-label" style={{ color: "var(--lime)" }}>
                  Open the room → inspect the evidence graph
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
