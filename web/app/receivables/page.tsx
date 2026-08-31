"use client";

/** The register: every receivable on the contract, newest first, plus the
 * connected wallet's own book. Paged reads — never a full scan. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getInvoices, getInvoicesFor } from "@/lib/read";
import type { Invoice } from "@/lib/types";
import { formatGen, formatStamp } from "@/lib/config";
import { useWallet } from "@/lib/wallet";
import { sameAddress } from "@/lib/chain";
import { StatusStamp } from "../components/bits";

const PAGE = 12;

export function LedgerRows({ list, me }: { list: Invoice[]; me: string }) {
  const router = useRouter();
  if (list.length === 0) return null;
  return (
    <div className="sheet sheet-ledger">
      <table className="ledger">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Face</th>
            <th>Parties</th>
            <th>Status</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody>
          {list.map((v) => (
            <tr key={v.invoice_id} className="rowlink"
              onClick={() => router.push(`/receivables/${v.invoice_id}`)}>
              <td>
                <Link href={`/receivables/${v.invoice_id}`}
                  style={{ textDecoration: "none", fontWeight: 600 }}>
                  <span className="v-mono" style={{ color: "var(--leaf)" }}>
                    {v.invoice_id}
                  </span>{" "}
                  {v.reference}
                </Link>
              </td>
              <td className="v-figure">{formatGen(v.amount_atto)} GEN</td>
              <td style={{ fontSize: 12.5 }}>
                {sameAddress(me, v.seller) ? "you sell" :
                 sameAddress(me, v.buyer) ? "you owe" :
                 sameAddress(me, v.provider) ? "you funded" : "third parties"}
                {v.buyer_ack_epoch ? " · countersigned" : ""}
                {v.buyer_dispute_epoch ? " · disputed" : ""}
              </td>
              <td><StatusStamp status={v.status} /></td>
              <td style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                {formatStamp(v.created_epoch)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
        const page = await getInvoices(offset, PAGE, true);
        if (!alive) return;
        setAll(page.invoices);
        setTotal(page.total);
        setProblem("");
        if (w.address) {
          const m = await getInvoicesFor(w.address, true);
          if (alive) setMine(m.reverse());
        } else {
          setMine([]);
        }
      } catch (e) {
        if (alive) setProblem(e instanceof Error ? e.message : "The chain could not be read.");
      }
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { alive = false; clearInterval(t); };
  }, [offset, w.address]);

  return (
    <div>
      <h1 className="v-display" style={{ fontSize: 34 }}>The register</h1>
      <p className="v-body" style={{ marginTop: 8 }}>
        Every receivable this contract has judged, is judging, or holds money
        against — read live from chain state.
      </p>
      {problem ? <p className="note bad">{problem}</p> : null}

      {w.address && mine.length > 0 ? (
        <>
          <div className="section-head">
            <span className="section-no">01</span>
            <h2>Your book</h2>
          </div>
          <LedgerRows list={mine} me={w.address} />
        </>
      ) : null}

      <div className="section-head">
        <span className="section-no">{w.address && mine.length ? "02" : "01"}</span>
        <h2>All instruments</h2>
        <span className="aside v-label">
          {total} registered · reading {offset + 1}–{Math.min(offset + PAGE, total)}
        </span>
      </div>
      {all.length === 0 ? (
        <p className="v-body">
          Nothing registered yet. The first invoice goes through{" "}
          <Link href="/create">Register</Link>.
        </p>
      ) : (
        <>
          <LedgerRows list={all} me={w.address} />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn btn-quiet" disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Newer
            </button>
            <button className="btn btn-quiet" disabled={offset + PAGE >= total}
              onClick={() => setOffset(offset + PAGE)}>
              Older
            </button>
          </div>
        </>
      )}
    </div>
  );
}
