"use client";

/** The register: every receivable as a row-card — figure forward, chips for
 * state, one click through. Paged reads, never a full scan. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { getInvoices, getInvoicesFor } from "@/lib/read";
import type { Invoice } from "@/lib/types";
import { formatGen, formatStamp } from "@/lib/config";
import { useWallet } from "@/lib/wallet";
import { sameAddress } from "@/lib/chain";
import { InstrumentGlyph, StatusStamp } from "../components/bits";

const PAGE = 12;

function roleFor(me: string, v: Invoice): string {
  if (sameAddress(me, v.seller)) return "you sell";
  if (sameAddress(me, v.buyer)) return "you owe";
  if (sameAddress(me, v.provider)) return "you funded";
  return "";
}

export function LedgerRows({ list, me }: { list: Invoice[]; me: string }) {
  if (list.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 12 }}>
      {list.map((v) => {
        const role = roleFor(me, v);
        return (
          <Link key={v.invoice_id} href={`/receivables/${v.invoice_id}`}
            className="row-card">
            <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
              <InstrumentGlyph id={v.invoice_id} size={40} />
              <div className="stack" style={{ gap: 8, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>
                  {formatGen(v.amount_atto)} GEN
                </span>
                <span className="v-mono" style={{ color: "var(--lichen)", fontSize: 12 }}>
                  {v.reference}
                </span>
              </div>
              <div className="chip-row">
                <StatusStamp status={v.status} />
                {role ? <span className="stamp tone-active">{role}</span> : null}
                {v.buyer_ack_epoch ? (
                  <span className="stamp tone-good">countersigned</span>
                ) : null}
                {v.buyer_dispute_epoch ? (
                  <span className="stamp tone-bad">disputed</span>
                ) : null}
              </div>
              </div>
            </div>
            <div className="stack" style={{ gap: 4, justifyItems: "end" }}>
              <span className="v-mono" style={{ color: "var(--lichen)", fontSize: 12 }}>
                due {formatStamp(v.due_epoch).slice(0, 10)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function ReceivablesPage() {
  const w = useWallet();
  const [mine, setMine] = useState<Invoice[]>([]);
  const [all, setAll] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const page = await getInvoices(offset, PAGE);
        if (!alive) return;
        setAll(page.invoices);
        setTotal(page.total);
        setProblem("");
        if (w.address) {
          const m = await getInvoicesFor(w.address);
          if (alive) setMine(m.reverse());
        } else {
          setMine([]);
        }
      } catch (e) {
        if (alive) setProblem(e instanceof Error ? e.message : "The chain could not be read.");
      }
    };
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [offset, w.address]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "end", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h1 className="v-display" style={{ fontSize: "clamp(32px, 4vw, 48px)" }}>
            The register
          </h1>
          <p className="v-body" style={{ marginTop: 10, marginBottom: 0 }}>
            Every receivable this contract has judged, is judging, or holds
            money against.
          </p>
        </div>
        <Link href="/create" className="btn" style={{ textDecoration: "none", marginLeft: "auto" }}>
          Register a receivable
        </Link>
      </div>
      {problem ? <p className="note bad" style={{ marginTop: 20 }}>{problem}</p> : null}

      {w.address && mine.length > 0 ? (
        <>
          <div className="section-head" style={{ marginTop: 56 }}>
            <span className="section-no">01</span>
            <h2>Your book</h2>
          </div>
          <LedgerRows list={mine} me={w.address} />
        </>
      ) : null}

      <div className="section-head" style={{ marginTop: w.address && mine.length ? 72 : 56 }}>
        <span className="section-no">{w.address && mine.length ? "02" : "01"}</span>
        <h2>All instruments</h2>
        <span className="aside v-label">{total} registered</span>
      </div>
      {all.length === 0 ? (
        <div className="tile" style={{ justifyItems: "start" }}>
          <span className="v-label">Nothing registered yet</span>
          <div className="big" style={{ fontSize: 22 }}>The first invoice goes here.</div>
          <Link href="/create" className="btn" style={{ textDecoration: "none", marginTop: 8 }}>
            Register it
          </Link>
        </div>
      ) : (
        <>
          <LedgerRows list={all} me={w.address} />
          {total > PAGE ? (
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-quiet" disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                Newer
              </button>
              <button className="btn btn-quiet" disabled={offset + PAGE >= total}
                onClick={() => setOffset(offset + PAGE)}>
                Older
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
