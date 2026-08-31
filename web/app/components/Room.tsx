"use client";

/**
 * The Receivable Room — one instrument, every fact about it, and every verb
 * the connected wallet is actually entitled to. Status comes from the
 * contract on an interval; nothing here invents a transition, and every
 * write closes through a fresh authoritative read plus the finality watch.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAssessment, getEvidence, getInvoice, getClaimable, invalidateReads,
} from "@/lib/read";
import type { Assessment, Invoice, Manifest } from "@/lib/types";
import {
  CONTRACT_ADDRESS, formatBps, formatGen, formatSpan, formatStamp,
} from "@/lib/config";
import { sameAddress, truncAddr } from "@/lib/chain";
import { useWallet } from "@/lib/wallet";
import { inFlight, writeAndConfirm, type TxProgress } from "@/lib/tx";
import * as P from "@/lib/predicates";
import { MONITORING_LABEL } from "@/lib/taxonomy";
import { AssessmentSheet } from "./AssessmentSheet";
import { EvidenceGraph } from "./EvidenceGraph";
import { EvidenceEditor, blank, toItemsJson, type DraftItem } from "./EvidenceEditor";
import { InstrumentGlyph, MonoRow, StatusStamp } from "./bits";
import { TxFlow } from "./TxFlow";

const REFRESH_MS = 45_000;

function useNowSec(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function Room({ id }: { id: string }) {
  const w = useWallet();
  const now = useNowSec();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<Assessment[]>([]);
  const [claimable, setClaimable] = useState("0");
  const [readProblem, setReadProblem] = useState("");
  const [tx, setTx] = useState<TxProgress>({ stage: "idle", detail: "" });
  const busy = inFlight(tx.stage);
  const alive = useRef(true);
  const histVersion = useRef(-1);

  const refresh = useCallback(async (force = false) => {
    try {
      const v = await getInvoice(id, force);
      if (!alive.current) return;
      setInv(v);
      setReadProblem("");
      if (!v) return;
      const version = v.evidence_version;
      const shownVersion =
        v.pending_version || v.assessed_version || version;
      const [man, a] = await Promise.all([
        version ? getEvidence(id, version, force) : Promise.resolve(null),
        shownVersion ? getAssessment(id, shownVersion, force) : Promise.resolve(null),
      ]);
      if (!alive.current) return;
      setManifest(man);
      setAssessment(a);
      // History is append-only: re-read it only when the version count
      // moves, not on every ambient tick — the read budget is real.
      if (histVersion.current !== version) {
        const hist: Assessment[] = [];
        for (let vv = 1; vv <= version; vv++) {
          if (vv === shownVersion && a) { hist.push(a); continue; }
          const h = await getAssessment(id, vv, force);
          if (h) hist.push(h);
        }
        if (!alive.current) return;
        histVersion.current = version;
        setHistory(hist);
      }
      if (w.address) {
        const cl = await getClaimable(w.address, force);
        if (alive.current) setClaimable(cl);
      }
    } catch (e) {
      if (alive.current) {
        setReadProblem(e instanceof Error ? e.message : "The chain could not be read.");
      }
    }
  }, [id, w.address]);

  useEffect(() => {
    alive.current = true;
    // First read deferred a tick so a mount never renders twice in one pass.
    const kick = setTimeout(() => void refresh(true), 0);
    // Ambient ticks ride the caches; only user actions force a fresh read.
    const t = setInterval(() => void refresh(false), REFRESH_MS);
    return () => { alive.current = false; clearTimeout(kick); clearInterval(t); };
  }, [refresh]);

  const write = useCallback(async (
    functionName: string,
    args: unknown[],
    valueAtto: bigint,
    predicate: () => Promise<boolean>,
    confirmedDetail?: string,
  ) => {
    if (!w.client) return;
    try {
      await writeAndConfirm({
        client: w.client,
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        valueAtto,
        predicate,
        onProgress: setTx,
        confirmedDetail,
      });
    } catch {
      /* the stepper already shows the terminal stage */
    } finally {
      invalidateReads();
      void refresh(true);
    }
  }, [w.client, refresh]);

  if (!inv) {
    return (
      <div>
        <p className="v-body">{readProblem || "Reading the contract…"}</p>
      </div>
    );
  }

  const me = w.address;
  const isSeller = sameAddress(me, inv.seller);
  const isBuyer = sameAddress(me, inv.buyer);
  const amount = BigInt(inv.amount_atto);
  const fee = (amount * BigInt(inv.fee_bps)) / 10_000n;

  return (
    <div>
      {/* ── the instrument hero: a mark and a name, not identifiers ───── */}
      <div className="hero-card">
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <InstrumentGlyph id={inv.invoice_id} size={52} />
          <div style={{ minWidth: 0 }}>
            <div className="hero-amount" style={{ fontSize: "clamp(28px, 3.6vw, 44px)" }}>
              {formatGen(inv.amount_atto)} GEN receivable
            </div>
            <div className="v-mono" style={{ color: "var(--lichen)", fontSize: 13, marginTop: 4 }}>
              {inv.reference} · due {formatStamp(inv.due_epoch).slice(0, 10)} ·
              seller {truncAddr(inv.seller)} · buyer {truncAddr(inv.buyer)}
            </div>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <StatusStamp status={inv.status} />
          </span>
        </div>
        <div className="chip-row">
          {inv.buyer_ack_epoch ? (
            <span className="stamp tone-good">countersigned on-chain</span>
          ) : (
            <span className="stamp tone-neutral">not countersigned</span>
          )}
          {inv.buyer_dispute_epoch ? (
            <span className="stamp tone-bad">buyer dispute open</span>
          ) : null}
          {(inv.status === "FUNDED" || inv.status === "REPAID") && inv.monitoring !== "NONE" ? (
            <span className={`stamp ${inv.monitoring === "NORMAL" ? "tone-active" : "tone-hold"}`}>
              monitoring {MONITORING_LABEL[inv.monitoring] ?? inv.monitoring}
            </span>
          ) : null}
        </div>
        {inv.buyer_dispute_text ? (
          <p className="note bad" style={{ margin: 0 }}>
            The buyer&apos;s wallet filed on-chain: “{inv.buyer_dispute_text}”
          </p>
        ) : null}
      </div>

      <div className="room-grid">
        {/* ── main column: verdict, evidence, record ─────────────────── */}
        <div className="room-main">
          <div className="section-head" style={{ marginTop: 0 }}>
            <span className="section-no">01</span>
            <h2>The verdict</h2>
            {inv.status === "PENDING_FINALITY" ? (
              <span className="aside v-label">
                {inv.pending_until_epoch > now
                  ? `window closes in ${formatSpan(inv.pending_until_epoch - now)}`
                  : "window closed — awaiting promotion"}
              </span>
            ) : null}
          </div>
          {assessment ? (
            <AssessmentSheet a={assessment} invoice={inv} />
          ) : inv.pending_version || inv.assessed_version ? (
            <p className="v-body">Reading the verdict from the chain…</p>
          ) : (
            <p className="v-body">
              No assessment yet. The seller commits evidence, then puts the
              record to the panel.
            </p>
          )}

          <div className="section-head">
            <span className="section-no">02</span>
            <h2>The evidence</h2>
            <span className="aside v-label">version {inv.evidence_version || "—"}</span>
          </div>
          <EvidenceGraph manifest={manifest} assessment={assessment} />

      {/* ── position, record & history — folded ───────────────────────── */}
      <details style={{ marginTop: 56 }}>
        <summary className="v-label" style={{ cursor: "pointer" }}>
          Position, record &amp; history
        </summary>
        <div className="stack" style={{ marginTop: 16 }}>
      <div className="sheet">
        <dl className="defs">
          <div className="def-row">
            <dt>Invoice value</dt>
            <dd className="v-figure">{formatGen(inv.amount_atto)} GEN</dd>
          </div>
          <div className="def-row">
            <dt>Advance {inv.advance_rate_bps ? `(${formatBps(inv.advance_rate_bps)})` : ""}</dt>
            <dd className="v-figure">
              {inv.advance_rate_bps ? `${formatGen(inv.advance_atto)} GEN` : "—"}
            </dd>
          </div>
          <div className="def-row">
            <dt>Factoring fee {inv.fee_bps ? `(${formatBps(inv.fee_bps)})` : ""}</dt>
            <dd className="v-figure">{inv.fee_bps ? `${formatGen(fee)} GEN` : "—"}</dd>
          </div>
          <div className="def-row">
            <dt>Funded</dt>
            <dd className="v-figure">
              {inv.funded_epoch ? `${formatGen(inv.funded_advance_atto)} GEN` : "—"}
            </dd>
          </div>
          <div className="def-row">
            <dt>Repaid</dt>
            <dd className="v-figure">
              {inv.repaid_epoch ? `${formatGen(inv.repaid_atto)} GEN` : "—"}
            </dd>
          </div>
          {inv.settlement ? (
            <>
              <div className="def-row">
                <dt>To the capital provider (advance + fee)</dt>
                <dd className="v-figure">{formatGen(inv.settlement.provider_total_atto)} GEN</dd>
              </div>
              <div className="def-row total">
                <dt>To the seller (reserve, net of fee)</dt>
                <dd className="v-figure">{formatGen(inv.settlement.seller_total_atto)} GEN</dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>
      <div className="sheet">
        <dl className="defs">
          <MonoRow label="Contract" value={CONTRACT_ADDRESS} />
          <MonoRow label="Invoice" value={inv.invoice_id} />
          <MonoRow label="Status" value={inv.status} />
          <MonoRow label="Evidence root" value={inv.evidence_root} />
          <MonoRow label="Assessed version" value={String(inv.assessed_version || "—")} />
          <MonoRow label="Registered" value={formatStamp(inv.created_epoch)} />
          {inv.funded_epoch ? <MonoRow label="Funded" value={formatStamp(inv.funded_epoch)} /> : null}
          {inv.repaid_epoch ? <MonoRow label="Repaid" value={formatStamp(inv.repaid_epoch)} /> : null}
          {inv.settled_epoch ? <MonoRow label="Settled" value={formatStamp(inv.settled_epoch)} /> : null}
        </dl>
        {history.length > 1 ? (
          <>
            <hr className="hr-rule" />
            <div className="v-label">Every assessment, preserved</div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {history.map((h) => (
                <div key={h.assessment_id} className="v-mono" style={{ fontSize: 12 }}>
                  v{h.evidence_version} · {h.decision} · {h.risk} · score {h.score} ·{" "}
                  {formatStamp(h.observed_epoch)}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
        </div>
      </details>
        </div>

        {/* ── the rail: what this wallet can do, always in view ────────── */}
        <aside className="room-rail">
          <span className="v-label">Actions</span>
          {!me ? (
            <div className="sheet" style={{ padding: 20 }}>
              <p className="v-body" style={{ margin: 0, fontSize: 13.5 }}>
                Connect a wallet to act on this receivable.
              </p>
            </div>
          ) : (
            <Actions
              inv={inv} now={now} me={me}
              isSeller={isSeller} isBuyer={isBuyer}
              busy={busy} write={write} claimable={claimable}
            />
          )}
          <TxFlow p={tx} />
        </aside>
      </div>
    </div>
  );
}

/* ── the verbs, role-gated ──────────────────────────────────────────────── */

function Actions({
  inv, now, me, isSeller, isBuyer, busy, write, claimable,
}: {
  inv: Invoice;
  now: number;
  me: string;
  isSeller: boolean;
  isBuyer: boolean;
  busy: boolean;
  claimable: string;
  write: (
    fn: string, args: unknown[], value: bigint,
    predicate: () => Promise<boolean>, detail?: string,
  ) => Promise<void>;
}) {
  const [disputeText, setDisputeText] = useState("");
  const [challengeReason, setChallengeReason] = useState("");
  const [challengeItems, setChallengeItems] = useState<DraftItem[]>([blank()]);
  const [recommit, setRecommit] = useState(false);
  const [recommitItems, setRecommitItems] = useState<DraftItem[]>(
    [blank(), blank()]);

  const cards: React.ReactNode[] = [];
  const amount = BigInt(inv.amount_atto);
  const id = inv.invoice_id;

  // seller ──────────────────────────────────────────────────────────────
  if (isSeller && inv.status === "COMMITTED") {
    cards.push(
      <ActionCard key="assess" title="Put the record to the panel"
        body={`The panel reads version ${inv.evidence_version} under consensus;
          the verdict waits out a ${formatSpan(inv.challenge_window_seconds)}
          challenge window before taking effect.`}>
        <button className="btn" disabled={busy}
          onClick={() => void write("request_assessment", [id], 0n,
            P.assessmentPendingAt(id, inv.evidence_version),
            "The panel has ruled. The verdict is recorded and its challenge window is running.")}>
          Request assessment
        </button>
      </ActionCard>,
    );
  }
  if (isSeller && ["DRAFT", "COMMITTED", "NOT_FINANCEABLE", "REVIEW", "FINANCEABLE"]
      .includes(inv.status) && !inv.challenge_open) {
    cards.push(
      <ActionCard key="recommit"
        title={inv.evidence_version ? "Commit a new evidence version" : "Commit the evidence"}
        body={inv.evidence_version
          ? "A new version requires a fresh assessment - terms always follow the latest bytes."
          : "The record the panel will read: documents as exact bytes, pages as frozen urls."}>
        {recommit ? (
          <div style={{ display: "grid", gap: 12 }}>
            <EvidenceEditor items={recommitItems} onChange={setRecommitItems} />
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" disabled={busy}
                onClick={() => void write("commit_evidence",
                  [id, toItemsJson(recommitItems)], 0n,
                  P.evidenceVersionIs(id, inv.evidence_version + 1),
                  "Evidence committed and frozen.")}>
                Commit version {inv.evidence_version + 1}
              </button>
              <button className="btn btn-quiet" onClick={() => setRecommit(false)}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-quiet" onClick={() => setRecommit(true)}>
            Open the composer
          </button>
        )}
      </ActionCard>,
    );
  }
  if (isSeller && inv.funded_epoch > 0 && !inv.advance_claimed) {
    cards.push(
      <ActionCard key="advance" title="Claim the advance"
        body={`${formatGen(inv.funded_advance_atto)} GEN is credited to you from funding.`}>
        <button className="btn" disabled={busy}
          onClick={() => void write("claim_advance", [id], 0n,
            P.claimableDrained(me), "The advance is on its way to your wallet.")}>
          Claim {formatGen(inv.funded_advance_atto)} GEN
        </button>
      </ActionCard>,
    );
  }
  if (isSeller && ["DRAFT", "COMMITTED", "PENDING_FINALITY", "FINANCEABLE",
                   "NOT_FINANCEABLE", "REVIEW"].includes(inv.status)
      && !inv.challenge_open) {
    cards.push(
      <ActionCard key="cancel" title="Cancel the registration" quiet
        body="Available until funding moves. Cancellation is terminal.">
        <button className="btn btn-danger" disabled={busy}
          onClick={() => void write("cancel_invoice", [id], 0n,
            P.statusIs(id, ["CANCELLED"]), "Cancelled.")}>
          Cancel invoice
        </button>
      </ActionCard>,
    );
  }

  // buyer ───────────────────────────────────────────────────────────────
  if (isBuyer && !inv.buyer_ack_epoch
      && !["SETTLED", "CANCELLED", "EXPIRED"].includes(inv.status)) {
    cards.push(
      <ActionCard key="ack" title="Acknowledge the obligation"
        body="The one identity fact the seller cannot manufacture - and it raises the advance the table authorizes.">
        <button className="btn" disabled={busy}
          onClick={() => void write("acknowledge_invoice", [id], 0n,
            P.acknowledged(id), "Acknowledged on-chain.")}>
          Acknowledge
        </button>
      </ActionCard>,
    );
  }
  if (isBuyer && !inv.buyer_dispute_epoch
      && !["SETTLED", "CANCELLED", "EXPIRED"].includes(inv.status)) {
    cards.push(
      <ActionCard key="dispute" title="Dispute the invoice" quiet
        body="On-chain, from your wallet. No assessment can conclude financeable while it is open.">
        <div style={{ display: "grid", gap: 10 }}>
          <textarea rows={3} value={disputeText}
            placeholder="What is wrong with this invoice?"
            onChange={(e) => setDisputeText(e.target.value)} />
          <button className="btn btn-danger" disabled={busy || disputeText.trim().length < 10}
            onClick={() => void write("file_buyer_dispute", [id, disputeText.trim()], 0n,
              P.disputeFiled(id), "Your dispute is on the record.")}>
            File the dispute
          </button>
        </div>
      </ActionCard>,
    );
  }
  if (isBuyer && ["FUNDED", "DEFAULTED"].includes(inv.status)) {
    cards.push(
      <ActionCard key="repay" title="Repay the invoice"
        body={`The full amount, in one payment: ${formatGen(inv.amount_atto)} GEN.
          The contract holds it until the deterministic split executes.`}>
        <button className="btn" disabled={busy}
          onClick={() => void write("repay", [id], amount,
            P.statusIs(id, ["REPAID"]), "Repayment received into custody.")}>
          Repay {formatGen(inv.amount_atto)} GEN
        </button>
      </ActionCard>,
    );
  }

  // capital provider ────────────────────────────────────────────────────
  if (!isSeller && !isBuyer && inv.status === "FINANCEABLE"
      && !inv.challenge_open && now <= inv.funding_deadline_epoch) {
    cards.push(
      <ActionCard key="fund" title="Fund this receivable"
        body={`Deposit the advance — exactly ${formatGen(inv.advance_atto)} GEN
          (${formatBps(inv.advance_rate_bps)} of face). Repayment returns your
          principal plus the ${formatBps(inv.fee_bps)} factoring fee.`}>
        <button className="btn" disabled={busy}
          onClick={() => void write("fund", [id], BigInt(inv.advance_atto),
            P.fundedBy(id, me), "Funded. The advance is credited to the seller.")}>
          Fund {formatGen(inv.advance_atto)} GEN
        </button>
      </ActionCard>,
    );
  }

  // permissionless keeping ──────────────────────────────────────────────
  if (inv.status === "PENDING_FINALITY" && !inv.challenge_open
      && now > inv.pending_until_epoch) {
    cards.push(
      <ActionCard key="finalize" title="Promote the verdict"
        body="The challenge window has lapsed unchallenged. Promotion is
          permissionless — anyone may make the verdict effective.">
        <button className="btn" disabled={busy}
          onClick={() => void write("finalize_assessment", [id], 0n,
            P.promotedFrom(id, inv.pending_version),
            "The verdict is now in effect.")}>
          Finalize assessment
        </button>
      </ActionCard>,
    );
  }
  if (["PENDING_FINALITY", "FINANCEABLE", "FUNDED"].includes(inv.status)
      && !inv.challenge_open && !isSeller) {
    cards.push(
      <ActionCard key="challenge" title="Challenge the record" quiet
        body={`Bond ${formatGen(inv.challenge_bond_required_atto)} GEN with new
          evidence; the panel re-judges the whole record. A changed verdict
          or risk returns the bond.`}>
        <div style={{ display: "grid", gap: 10 }}>
          <textarea rows={2} value={challengeReason}
            placeholder="Your grounds (at least 20 characters)"
            onChange={(e) => setChallengeReason(e.target.value)} />
          <EvidenceEditor items={challengeItems} onChange={setChallengeItems}
            min={1} max={4} />
          <button className="btn btn-danger"
            disabled={busy || challengeReason.trim().length < 20}
            onClick={() => void write("challenge",
              [id, challengeReason.trim(), toItemsJson(challengeItems)],
              BigInt(inv.challenge_bond_required_atto),
              P.challengeOpenIs(id, true),
              "Your challenge is on the record. Anyone may now run the reassessment.")}>
            Bond {formatGen(inv.challenge_bond_required_atto)} GEN and challenge
          </button>
        </div>
      </ActionCard>,
    );
  }
  if (inv.challenge_open) {
    cards.push(
      <ActionCard key="reassess" title="Run the reassessment"
        body={`The panel re-judges version ${inv.challenge_new_version}.
          Permissionless - a failed round can be retried by anyone.`}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" disabled={busy}
            onClick={() => void write("reassess", [id], 0n,
              P.challengeOpenIs(id, false),
              "The reassessment has ruled and the challenge is resolved.")}>
            Reassess now
          </button>
          {now > inv.challenge_filed_epoch + 3600 ? (
            <button className="btn btn-quiet" disabled={busy}
              onClick={() => void write("challenge_lapse", [id], 0n,
                P.challengeOpenIs(id, false),
                "The challenge lapsed; the snapshot taken at filing is restored.")}>
              Declare it stale
            </button>
          ) : null}
        </div>
      </ActionCard>,
    );
  }
  if (inv.status === "REPAID" && !inv.challenge_open) {
    cards.push(
      <ActionCard key="prepare" title="Prepare the settlement"
        body="Computes the split from state and freezes it. Payment is the next, separate step.">
        <button className="btn" disabled={busy}
          onClick={() => void write("prepare_settlement", [id], 0n,
            P.statusIs(id, ["SETTLEMENT_READY"]),
            "The split is prepared and frozen.")}>
          Prepare settlement
        </button>
      </ActionCard>,
    );
  }
  if (inv.status === "SETTLEMENT_READY") {
    cards.push(
      <ActionCard key="execute" title="Execute the settlement"
        body="Pays exactly the prepared record. Once, ever.">
        <button className="btn" disabled={busy}
          onClick={() => void write("execute_settlement", [id], 0n,
            P.statusIs(id, ["SETTLED"]), "Settled. Balances are claimable.")}>
          Execute settlement
        </button>
      </ActionCard>,
    );
  }
  if (inv.status === "FINANCEABLE" && now > inv.funding_deadline_epoch
      && !inv.challenge_open) {
    cards.push(
      <ActionCard key="expire" title="Mark it expired" quiet
        body="Nobody funded it by the deadline. Permissionless housekeeping.">
        <button className="btn btn-quiet" disabled={busy}
          onClick={() => void write("mark_expired", [id], 0n,
            P.statusIs(id, ["EXPIRED"]), "Expired.")}>
          Mark expired
        </button>
      </ActionCard>,
    );
  }
  if (inv.status === "FUNDED" && now > inv.due_epoch + 86_400) {
    cards.push(
      <ActionCard key="default" title="Mark the default" quiet
        body="Due date plus grace passed unpaid. The record states the loss honestly.">
        <button className="btn btn-danger" disabled={busy}
          onClick={() => void write("mark_defaulted", [id], 0n,
            P.statusIs(id, ["DEFAULTED"]), "Recorded as defaulted.")}>
          Mark defaulted
        </button>
      </ActionCard>,
    );
  }
  if (BigInt(claimable) > 0n) {
    cards.push(
      <ActionCard key="claim" title="Claim your balance"
        body={`${formatGen(claimable)} GEN is credited to your address across
          this contract — advances, settlements, returned bonds.`}>
        <button className="btn" disabled={busy}
          onClick={() => void write("claim", [], 0n,
            P.claimableDrained(me), "Claimed — the transfer rides finalization.")}>
          Claim {formatGen(claimable)} GEN
        </button>
      </ActionCard>,
    );
  }

  if (cards.length === 0) {
    return (
      <p className="v-body">
        Nothing for this wallet to do right now — the state advances when
        other parties act, and this page keeps reading.
      </p>
    );
  }
  return <div className="stack" style={{ gap: 12 }}>{cards}</div>;
}

function ActionCard({
  title, body, children, quiet = false,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
  quiet?: boolean;
}) {
  return (
    <div className="sheet"
      style={{ padding: 20, ...(quiet ? { background: "var(--paper)" } : {}) }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600 }}>{title}</div>
        <p className="v-body" style={{ margin: 0, fontSize: 13 }}>{body}</p>
        {children}
      </div>
    </div>
  );
}
