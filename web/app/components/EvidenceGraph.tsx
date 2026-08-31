"use client";

/**
 * The evidence graph: why this receivable is (or is not) financeable, as a
 * printed schematic — the three pillars a financing decision rests on, each
 * traced to the exact committed items that carried it, each item expandable
 * to its provenance, digest, and the bytes the panel actually read.
 *
 * Everything here is authoritative state: the manifest and dossier come from
 * the contract; nothing is decorated in.
 */
import type { Assessment, Manifest } from "@/lib/types";
import {
  CONFLICT_LABEL, EVIDENCE_TYPE_LABEL, EXCLUSION_LABEL, FINDING_LABEL,
} from "@/lib/taxonomy";

const PILLAR_CLASS: Record<string, string> = {
  SUPPORTED: "supported",
  NOT_SUPPORTED: "not-supported",
  INSUFFICIENT: "insufficient",
};

export function EvidenceGraph({
  manifest, assessment,
}: {
  manifest: Manifest | null;
  assessment: Assessment | null;
}) {
  if (!manifest) {
    return <p className="v-body">No evidence has been committed yet.</p>;
  }
  const excludedBy = new Map(
    (assessment?.excluded ?? []).map((e) => [e.id, e.code]));
  const examined = new Set(assessment?.examined ?? []);
  const rowByld = new Map((assessment?.rows ?? []).map((r) => [r.id, r]));

  return (
    <div className="graph">
      {assessment ? (
        <>
          <div className="graph-pillars">
            {(
              [
                ["The seller", assessment.seller_finding],
                ["The buyer", assessment.buyer_finding],
                ["The transaction", assessment.transaction_finding],
              ] as const
            ).map(([who, finding]) => (
              <div key={who} className={`pillar ${PILLAR_CLASS[finding] ?? ""}`}>
                <div className="v-label">{who}</div>
                <div className="v-figure" style={{ fontSize: 19, marginTop: 4 }}>
                  {FINDING_LABEL[finding] ?? finding}
                </div>
              </div>
            ))}
          </div>
          {assessment.conflicts.length > 0 ? (
            <div className="note hold" style={{ marginTop: 16 }}>
              <span className="v-label" style={{ color: "inherit" }}>
                Material conflicts on the record
              </span>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {assessment.conflicts.map((code) => (
                  <li key={code}>{CONFLICT_LABEL[code] ?? code}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="graph-spine" style={{ marginTop: 16 }} />
        </>
      ) : null}

      <div className="sheet-ledger sheet">
        {manifest.items.map((it) => {
          const row = rowByld.get(it.id);
          const wasExcluded = excludedBy.get(it.id);
          const wasExamined = examined.has(it.id);
          return (
            <details key={it.id} className="evidence-node" style={{ display: "block" }}>
              <summary>
                <span style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="v-mono" style={{ color: "var(--lime)" }}>{it.id}</span>
                  <span style={{ }}>{it.label}</span>
                  <span className="v-label">{EVIDENCE_TYPE_LABEL[it.type] ?? it.type}</span>
                  <span style={{ marginLeft: "auto" }}>
                    {assessment ? (
                      wasExamined ? (
                        <span className="stamp tone-good">examined</span>
                      ) : wasExcluded ? (
                        <span className="stamp tone-neutral">
                          {EXCLUSION_LABEL[wasExcluded] ?? wasExcluded}
                        </span>
                      ) : (
                        <span className="stamp tone-neutral">not yet judged</span>
                      )
                    ) : (
                      <span className="stamp tone-neutral">committed</span>
                    )}
                  </span>
                </span>
              </summary>
              <div style={{ gridColumn: "1 / -1", paddingTop: 10, display: "grid", gap: 8 }}>
                {row ? (
                  <p className="marginalia">{row.provenance}</p>
                ) : it.type === "external_url" ? (
                  <p className="marginalia">
                    External page — the contract fetches it itself, under
                    consensus, at judgment time.
                  </p>
                ) : (
                  <p className="marginalia">
                    Seller-declared document — hashed and frozen at commitment;
                    a party&apos;s claim, not a verified fact, and the panel is
                    told so.
                  </p>
                )}
                {it.url ? (
                  <div className="v-mono breakable">{it.url}</div>
                ) : null}
                <div className="sheet-recessed v-mono" style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>
                  {row && row.excerpt
                    ? row.excerpt
                    : it.content || "[fetched at judgment time]"}
                </div>
                <div className="v-mono" style={{ color: "var(--lichen)" }}>
                  {row
                    ? `judged bytes sha256 ${row.digest}`
                    : `committed sha256 ${it.content_hash}`}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
