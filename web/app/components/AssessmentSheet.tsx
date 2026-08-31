"use client";

/**
 * The verdict, slim: the seal, the derived facts as chips, the panel's
 * reasoning, and a technical drawer for everything else. The decision,
 * risk, findings, examined set, conflicts and score bucket are
 * consensus-pinned; the exact figure and the prose are the deciding
 * validator's, labelled inside the drawer rather than paraded.
 */
import type { Assessment, Invoice } from "@/lib/types";
import { formatBps, formatStamp } from "@/lib/config";
import { DECISION_LABEL, RISK_LABEL } from "@/lib/taxonomy";
import { MonoRow } from "./bits";

export function AssessmentSheet({
  a, invoice,
}: {
  a: Assessment;
  invoice: Invoice;
}) {
  const sealClass =
    a.decision === "FINANCEABLE" ? "" :
    a.decision === "REVIEW_REQUIRED" ? "held" : "refused";
  const effective = invoice.assessed_version === a.evidence_version;
  const pending = invoice.pending_version === a.evidence_version
    && invoice.status === "PENDING_FINALITY";

  return (
    <div className="sheet" style={{ display: "grid", gap: 20, padding: 32 }}>
      <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
        <div className="seal-wrap">
          <div className={`seal ${sealClass}`}
            style={{ "--score": a.score } as React.CSSProperties} />
          <div className="seal-figure">
            <div className="score">{a.score}</div>
            <div className="v-label">of 100</div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12, flex: 1, minWidth: 260 }}>
          <div className="v-display" style={{ fontSize: 30 }}>
            {DECISION_LABEL[a.decision] ?? a.decision}
          </div>
          <div className="chip-row">
            <span className={`stamp ${a.decision === "FINANCEABLE" ? "tone-good" : "tone-hold"}`}>
              {RISK_LABEL[a.risk] ?? a.risk}
            </span>
            {a.decision === "FINANCEABLE" ? (
              <span className="stamp tone-active">
                {formatBps(a.advance_rate_bps)} advance · {formatBps(a.fee_bps)} fee
              </span>
            ) : null}
            <span className="stamp tone-neutral">
              {a.examined_count}/{a.committed_count} examined
            </span>
            {effective ? (
              <span className="stamp tone-good">in effect</span>
            ) : pending ? (
              <span className="stamp tone-hold">pending finality</span>
            ) : null}
          </div>
          <p className="v-body" style={{ margin: 0, fontSize: 15 }}>
            {a.reason}
          </p>
        </div>
      </div>

      <details>
        <summary className="v-label" style={{ cursor: "pointer" }}>
          The full finding
        </summary>
        <dl className="defs" style={{ marginTop: 12 }}>
          <MonoRow label="Seller pillar" value={a.seller_finding} />
          <MonoRow label="Buyer pillar" value={a.buyer_finding} />
          <MonoRow label="Transaction pillar" value={a.transaction_finding} />
          <MonoRow label="Obligation"
            value={a.buyer_acknowledged ? "countersigned on-chain" : "declared only (advance capped)"} />
          {a.conflicts.length ? (
            <MonoRow label="Conflicts" value={a.conflicts.join(", ")} />
          ) : null}
          <MonoRow label="Assessment" value={a.assessment_id} />
          <MonoRow label="Evidence root" value={a.evidence_root} />
          <MonoRow label="Judged at" value={formatStamp(a.observed_epoch)} />
        </dl>
        <p className="marginalia" style={{ marginTop: 12 }}>
          Decision, risk, findings, examined set, conflicts and the score
          bucket are consensus-pinned; the exact figure and the reasoning are
          the deciding validator&apos;s, recorded as such.
        </p>
      </details>
    </div>
  );
}
