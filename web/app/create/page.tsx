"use client";

/**
 * Register a receivable, then commit its first evidence version — two writes,
 * one flow, every bound taken from the contract's own get_config.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CONTRACT_ADDRESS, formatGen } from "@/lib/config";
import { getConfig, getInvoicesFor, invalidateReads } from "@/lib/read";
import type { ChainConfig } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { inFlight, writeAndConfirm, type TxProgress } from "@/lib/tx";
import * as P from "@/lib/predicates";
import { EvidenceEditor, blank, itemProblem, toItemsJson, type DraftItem } from "../components/EvidenceEditor";
import { TxFlow } from "../components/TxFlow";

const DAY = 86_400;

export default function CreatePage() {
  const w = useWallet();
  const router = useRouter();
  const [cfg, setCfg] = useState<ChainConfig | null>(null);
  const [buyer, setBuyer] = useState("");
  const [reference, setReference] = useState("");
  const [amountGen, setAmountGen] = useState("0.1");
  const [issueDate, setIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10));
  const [dueDays, setDueDays] = useState(30);
  const [fundDays, setFundDays] = useState(20);
  const [windowMin, setWindowMin] = useState(30);
  const [items, setItems] = useState<DraftItem[]>([blank(), blank(), blank()]);
  const [createdId, setCreatedId] = useState("");
  const [tx, setTx] = useState<TxProgress>({ stage: "idle", detail: "" });
  const busy = inFlight(tx.stage);

  useEffect(() => {
    void getConfig().then(setCfg).catch(() => setCfg(null));
  }, []);

  const amountAtto = useMemo(() => {
    try {
      const [whole, frac = ""] = amountGen.trim().split(".");
      return (BigInt(whole || "0") * 10n ** 18n
        + BigInt((frac + "0".repeat(18)).slice(0, 18))).toString();
    } catch {
      return "";
    }
  }, [amountGen]);

  const problems: string[] = [];
  if (!/^0x[0-9a-fA-F]{40}$/.test(buyer.trim())) {
    problems.push("The buyer must be a wallet address — the wallet that can countersign and repay.");
  }
  if (cfg && (reference.trim().length < cfg.reference_chars[0]
      || reference.trim().length > cfg.reference_chars[1])) {
    problems.push(`Reference: ${cfg.reference_chars[0]}–${cfg.reference_chars[1]} characters.`);
  }
  if (cfg && amountAtto && (BigInt(amountAtto) < BigInt(cfg.min_invoice_atto)
      || BigInt(amountAtto) > BigInt(cfg.max_invoice_atto))) {
    problems.push(`Amount: between ${formatGen(cfg.min_invoice_atto)} and ${formatGen(cfg.max_invoice_atto)} GEN.`);
  }
  if (fundDays >= dueDays) {
    problems.push("The funding deadline must fall before the due date.");
  }
  const itemProblems = items.map((it) => itemProblem(it, cfg)).filter(Boolean);

  const create = async () => {
    if (!w.client || !w.address) return;
    const seller = w.address;
    const mine = await getInvoicesFor(seller, true).catch(() => []);
    const prev = mine.length;
    const now = Math.floor(Date.now() / 1000);
    try {
      await writeAndConfirm({
        client: w.client,
        address: CONTRACT_ADDRESS,
        functionName: "create_invoice",
        args: [buyer.trim(), reference.trim(), amountAtto, issueDate,
          now + dueDays * DAY, now + fundDays * DAY, windowMin * 60],
        valueAtto: 0n,
        predicate: P.invoiceCountAbove(prev, seller, getInvoicesFor),
        onProgress: setTx,
        confirmedDetail: "Registered. Now commit the evidence.",
      });
      invalidateReads();
      const after = await getInvoicesFor(seller, true);
      const newest = after[after.length - 1];
      if (newest) setCreatedId(newest.invoice_id);
    } catch { /* stepper shows it */ }
  };

  const commit = async () => {
    if (!w.client || !createdId) return;
    try {
      await writeAndConfirm({
        client: w.client,
        address: CONTRACT_ADDRESS,
        functionName: "commit_evidence",
        args: [createdId, toItemsJson(items)],
        valueAtto: 0n,
        predicate: P.evidenceVersionIs(createdId, 1),
        onProgress: setTx,
        confirmedDetail: "Evidence committed and frozen. Opening the room…",
      });
      invalidateReads();
      router.push(`/receivables/${createdId}`);
    } catch { /* stepper shows it */ }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 className="v-display" style={{ fontSize: 34 }}>Register a receivable</h1>
      <p className="v-body" style={{ marginTop: 8 }}>
        Two steps: register the instrument, then commit its evidence as
        frozen bytes.
      </p>

      {!w.address ? (
        <p className="note hold" style={{ marginTop: 20 }}>
          Connect the seller&apos;s wallet to register.
        </p>
      ) : null}

      <div className="section-head">
        <span className="section-no">01</span>
        <h2>The instrument</h2>
      </div>
      <div className="sheet" style={{ display: "grid", gap: 14 }}>
        <div className="field">
          <label>Buyer wallet</label>
          <input type="text" value={buyer} placeholder="0x…"
            onChange={(e) => setBuyer(e.target.value)} disabled={!!createdId} />
          <span className="hint">
            The wallet that countersigns and repays. No countersignature caps
            the advance.
          </span>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Invoice reference</label>
            <input type="text" value={reference} placeholder="INV-2026-014"
              onChange={(e) => setReference(e.target.value)} disabled={!!createdId} />
          </div>
          <div className="field">
            <label>Amount (GEN)</label>
            <input type="text" value={amountGen}
              onChange={(e) => setAmountGen(e.target.value)} disabled={!!createdId} />
          </div>
        </div>
        <div className="grid-3">
          <div className="field">
            <label>Issue date</label>
            <input type="date" value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)} disabled={!!createdId} />
          </div>
          <div className="field">
            <label>Due in (days)</label>
            <input type="number" value={dueDays} min={1}
              onChange={(e) => setDueDays(Number(e.target.value))} disabled={!!createdId} />
          </div>
          <div className="field">
            <label>Funding open for (days)</label>
            <input type="number" value={fundDays} min={1}
              onChange={(e) => setFundDays(Number(e.target.value))} disabled={!!createdId} />
          </div>
        </div>
        <div className="field">
          <label>Challenge window (minutes)</label>
          <input type="number" value={windowMin} min={15}
            onChange={(e) => setWindowMin(Number(e.target.value))} disabled={!!createdId} />
          <span className="hint">
            Every verdict waits this long before taking effect. Minimum 15
            minutes.
          </span>
        </div>
        {!createdId ? (
          <>
            {problems.map((p) => <span key={p} className="problem">{p}</span>)}
            <button className="btn" disabled={busy || problems.length > 0 || !w.address}
              onClick={() => void create()}>
              Register the receivable
            </button>
          </>
        ) : (
          <p className="note good" style={{ margin: 0 }}>
            Registered as <span className="v-mono">{createdId}</span>.
          </p>
        )}
      </div>

      <div className="section-head">
        <span className="section-no">02</span>
        <h2>The evidence</h2>
      </div>
      <EvidenceEditor items={items} onChange={setItems} />
      {itemProblems.length > 0 && createdId ? (
        <p className="problem" style={{ marginTop: 10 }}>{itemProblems[0]}</p>
      ) : null}
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <button className="btn"
          disabled={busy || !createdId || itemProblems.length > 0}
          onClick={() => void commit()}>
          Commit evidence version 1
        </button>
        <TxFlow p={tx} />
      </div>
    </div>
  );
}
