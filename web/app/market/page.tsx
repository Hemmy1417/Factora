"use client";

/**
 * The funding marketplace. Even with nothing listed it is a real page: the
 * rate card renders the contract's own terms table, the pipeline shows the
 * instruments honestly on their way here, and the empty slot is drawn as
 * the shape a listing will occupy — anticipation, never fabrication.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { getConfig, getInvoices, getStats } from "@/lib/read";
import type { ChainConfig, Invoice, Stats } from "@/lib/types";
import { formatBps, formatGen, formatSpan } from "@/lib/config";
import { RISK_LABEL } from "@/lib/taxonomy";
import { InstrumentGlyph } from "../components/bits";
import { LedgerRows } from "../receivables/page";

export default function MarketPage() {
  const [open, setOpen] = useState<Invoice[]>([]);
  const [pipeline, setPipeline] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cfg, setCfg] = useState<ChainConfig | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        // One bounded page of the newest instruments; the marketplace shows
        // the financeable slice and, honestly, what is upstream of it.
        const page = await getInvoices(0, 50, true);
        const s = await getStats(true);
        const c = await getConfig();
        if (!alive) return;
        setOpen(page.invoices.filter(
          (v) => v.status === "FINANCEABLE" && !v.challenge_open));
        setPipeline(page.invoices.filter(
          (v) => ["COMMITTED", "PENDING_FINALITY"].includes(v.status)));
        setStats(s);
        setCfg(c);
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
        Judged financeable, final, and open. Inspect the evidence before you
        fund — that is what it is for.
      </p>
      {problem ? <p className="note bad">{problem}</p> : null}

      <div className="room-grid">
        <div className="room-main">
          <div className="section-head" style={{ marginTop: 0 }}>
            <span className="section-no">01</span>
            <h2>Open for funding</h2>
            {stats ? (
              <span className="aside v-label">
                {stats.invoices} registered · {stats.funded} funded
              </span>
            ) : null}
          </div>

          {open.length === 0 ? (
            <div className="ghost-slot">
              <span className="v-label" style={{ color: "var(--lichen)" }}>
                Specimen slot — the next financeable receivable lands here
              </span>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span className="glyph-seal" aria-hidden style={{
                  width: 44, height: 44,
                  border: "1.5px dashed var(--line-dark)",
                  background: "transparent", color: "var(--lichen)",
                  fontSize: 18,
                }}>
                  ?
                </span>
                <div style={{ display: "grid", gap: 8, flex: 1 }}>
                  <span className="ghost-bar" style={{ width: "42%" }} />
                  <span className="ghost-bar" style={{ width: "68%", opacity: 0.5 }} />
                </div>
                <span className="ghost-bar" style={{ width: 90, height: 30, borderRadius: 15 }} />
              </div>
              <p className="v-body" style={{ margin: 0, fontSize: 13.5 }}>
                A listing appears when a verdict reads FINANCEABLE, its
                challenge window has lapsed, and its funding window is open.
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 16 }}>
              {open.map((v) => {
                const advance = BigInt(v.advance_atto);
                return (
                  <Link key={v.invoice_id} href={`/receivables/${v.invoice_id}`}
                    className="action-card" style={{ textDecoration: "none", gap: 18 }}>
                    <div className="chip-row">
                      <InstrumentGlyph id={v.invoice_id} size={32} />
                      <span className="stamp tone-neutral" style={{ marginLeft: "auto" }}>
                        {RISK_LABEL[v.risk] ?? v.risk}
                      </span>
                      <span className={`stamp ${v.buyer_ack_epoch ? "tone-good" : "tone-neutral"}`}>
                        {v.buyer_ack_epoch ? "countersigned" : "declared only"}
                      </span>
                      <span className="stamp tone-hold">
                        {formatSpan(v.funding_deadline_epoch - now)} left
                      </span>
                    </div>
                    <div>
                      <div className="hero-amount" style={{ fontSize: "clamp(30px, 3.4vw, 44px)" }}>
                        {formatGen(v.amount_atto)} GEN
                      </div>
                      <div className="sub" style={{ color: "var(--lichen)", fontSize: 13, marginTop: 4 }}>
                        receivable · due in {formatSpan(v.due_epoch - now)}
                      </div>
                    </div>
                    <div className="tile-strip" style={{ gap: 10 }}>
                      <div className="sheet-recessed" style={{ padding: 14 }}>
                        <div className="v-label">Deposit</div>
                        <div className="v-figure" style={{ fontSize: 18 }}>
                          {formatGen(advance)} GEN
                        </div>
                        <div style={{ fontSize: 12, color: "var(--lichen)" }}>
                          {formatBps(v.advance_rate_bps)} advance
                        </div>
                      </div>
                      <div className="sheet-recessed" style={{ padding: 14 }}>
                        <div className="v-label">Your return</div>
                        <div className="v-figure" style={{ fontSize: 18 }}>
                          {formatBps(v.fee_bps)} fee
                        </div>
                      </div>
                      <div className="sheet-recessed" style={{ padding: 14 }}>
                        <div className="v-label">Score</div>
                        <div className="v-figure" style={{ fontSize: 18 }}>{v.score} / 100</div>
                      </div>
                    </div>
                    <span className="btn" style={{ textAlign: "center" }}>
                      Inspect the evidence, then fund
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="section-head">
            <span className="section-no">02</span>
            <h2>On the way</h2>
            <span className="aside v-label">
              upstream of the marketplace, live
            </span>
          </div>
          {pipeline.length === 0 ? (
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <p className="v-body" style={{ margin: 0 }}>
                Nothing is queued — the pipeline starts with a registration.
              </p>
              <Link href="/create" className="btn btn-quiet"
                style={{ textDecoration: "none" }}>
                Register a receivable
              </Link>
            </div>
          ) : (
            <LedgerRows list={pipeline} me="" />
          )}
        </div>

        {/* ── the rail: the contract's own rate card ──────────────────── */}
        <aside className="room-rail">
          <span className="v-label">The rate card</span>
          <div className="sheet" style={{ padding: 20 }}>
            {cfg ? (
              <div style={{ display: "grid", gap: 14 }}>
                {Object.keys(cfg.advance_bps).map((risk) => (
                  <div key={risk} className="sheet-recessed" style={{ padding: 14 }}>
                    <div className="chip-row" style={{ marginBottom: 8 }}>
                      <span className={`stamp ${risk === "LOW" ? "tone-good" : "tone-hold"}`}>
                        {RISK_LABEL[risk] ?? risk}
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--lichen)" }}>Advance, countersigned</span>
                        <span className="v-figure">{formatBps(cfg.advance_bps[risk])}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--lichen)" }}>Advance, declared only</span>
                        <span className="v-figure">{formatBps(cfg.advance_bps_no_ack[risk])}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--lichen)" }}>Factoring fee</span>
                        <span className="v-figure">{formatBps(cfg.fee_bps[risk])}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="v-body" style={{ margin: 0, fontSize: 12.5 }}>
                  Read from the contract&apos;s configuration. The panel pins
                  the risk class; this table — not the model — sets every
                  term, and a HIGH-risk record is simply not financeable.
                </p>
              </div>
            ) : (
              <p className="v-body" style={{ margin: 0, fontSize: 13 }}>
                Reading the rate card from the contract…
              </p>
            )}
          </div>
          <div className="sheet" style={{ padding: 20 }}>
            <span className="v-label">How a provider earns</span>
            <div style={{ display: "grid", gap: 8, marginTop: 10, fontSize: 13.5 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className="step-chip">1</span>
                <span>Deposit exactly the advance the table authorizes.</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className="step-chip">2</span>
                <span>The buyer repays face value into contract custody.</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className="step-chip">3</span>
                <span>Settlement returns your principal plus the fee — by
                  arithmetic, not by anyone&apos;s discretion.</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
