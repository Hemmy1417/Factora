"use client";

/**
 * The verdict as printed: the seal, the pinned facts, the counts that make
 * the examination auditable, and a technical drawer for the record's raw
 * identifiers.
 *
 * Honesty note carried into the copy: the DECISION, RISK CLASS, FINDINGS,
 * EXAMINED SET, CONFLICTS and SCORE BUCKET are consensus-pinned — every
 * validator agreed on them. The exact score inside the bucket and the prose
 * reason are the leader's composite, labelled as such, never as consensus.
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
  const pending = invoice.pending_version === a.evidence_version;

  return (
    <div className="sheet" style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div className="seal-wrap">
          <div className={`seal ${sealClass}`}
            style={{ "--score": a.score } as React.CSSProperties} />
          <div className="seal-figure">
            <div className="score">{a.score}</div>
            <div className="v-label">of 100</div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 240 }}>
          <div className="v-display" style={{ fontSize: 26 }}>
            {DECISION_LABEL[a.decision] ?? a.decision}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className="stamp tone-neutral">{RISK_LABEL[a.risk] ?? a.risk}</span>
            <span className="stamp tone-neutral">
              evidence v{a.evidence_version}
            </span>
            {effective ? (
              <span className="stamp tone-good">in effect</span>
            ) : pending ? (
              <span className="stamp tone-hold">pending finality</span>
            ) : (
              <span className="stamp tone-neutral">historical</span>
            )}
          </div>
          <p className="v-body" style={{ margin: "4px 0 0" }}>
            {a.reason}
          </p>
          <p className="marginalia">
            The decision, risk class, findings, examined set, conflicts and
            score bucket are consensus-pinned. The exact figure inside the
            bucket and this reasoning are the leading validator&apos;s
            composite, recorded as such.
          </p>
        </div>
      </div>

      <div className="grid-3">
        <div className="sheet-recessed">
          <div className="v-label">Examination</div>
          <div className="v-figure" style={{ fontSize: 22, marginTop: 4 }}>
            {a.examined_count} of {a.committed_count} examined
          </div>
          <div style={{ fontSize: 12.5, color: "var(--lichen)" }}>
            {a.excluded_count} excluded — every committed item lands in
            exactly one list, enforced as arithmetic.
          </div>
        </div>
        <div className="sheet-recessed">
          <div className="v-label">If financed at this reading</div>
          <div className="v-figure" style={{ fontSize: 22, marginTop: 4 }}>
            {a.decision === "FINANCEABLE"
              ? `${formatBps(a.advance_rate_bps)} advance`
              : "no terms"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--lichen)" }}>
            {a.decision === "FINANCEABLE"
              ? `${formatBps(a.fee_bps)} factoring fee — from the code table on
                 the pinned risk class${a.buyer_acknowledged ? "" :
                 ", capped: the buyer never countersigned"}`
              : "a non-financeable reading prices nothing"}
          </div>
        </div>
        <div className="sheet-recessed">
          <div className="v-label">The obligation</div>
          <div className="v-figure" style={{ fontSize: 22, marginTop: 4 }}>
            {a.buyer_acknowledged ? "Countersigned" : "Declared only"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--lichen)" }}>
            {a.buyer_dispute_open
              ? "The buyer's wallet has an open dispute on this record."
              : a.buyer_acknowledged
                ? "The buyer's own wallet acknowledged this obligation on-chain."
                : "No buyer acknowledgement — the advance table caps lower."}
          </div>
        </div>
      </div>

      <details>
        <summary className="v-label" style={{ cursor: "pointer" }}>
          Technical record
        </summary>
        <dl className="defs" style={{ marginTop: 10 }}>
          <MonoRow label="Assessment" value={a.assessment_id} />
          <MonoRow label="Invoice" value={a.invoice_id} />
          <MonoRow label="Evidence version" value={String(a.evidence_version)} />
          <MonoRow label="Evidence root" value={a.evidence_root} />
          <MonoRow label="Judged at" value={formatStamp(a.observed_epoch)} />
        </dl>
      </details>
    </div>
  );
}
