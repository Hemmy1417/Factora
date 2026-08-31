"use client";

import { STAGE_LABEL, STAGE_TRACK, stageClass, type TxProgress } from "@/lib/tx";

/**
 * The transaction stepper. Every write in this product renders one, so a user
 * is never left wondering whether something happened — the UI standard's
 * hardest requirement and the cheapest to get wrong.
 *
 * Terminal failures show what happened and what to do next; they never say
 * "something went wrong".
 */
export function TxFlow({ p }: { p: TxProgress }) {
  if (p.stage === "idle") return null;

  const terminal = p.stage === "rejected" || p.stage === "failed";

  return (
    /**
     * The live region wraps EVERYTHING, not just the stepper.
     *
     * With it on the stepper alone, a screen reader announces "Confirm in
     * wallet, Submitted, Pending" and never reads the sentence underneath,
     * which is the only part that says what actually happened: that the
     * request was declined, or that the write landed but StudioNet has not
     * caught up. Announcing the labels while withholding the outcome is worse
     * than announcing nothing.
     *
     * A failure interrupts rather than waits its turn, because by then the
     * user is being told their money did not move.
     */
    <div
      style={{ display: "grid", gap: 10 }}
      role={terminal ? "alert" : "status"}
      aria-live={terminal ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div className="stepper">
        {STAGE_TRACK.map((s, i) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            {i > 0 ? <span className="step-sep">·</span> : null}
            <span className={stageClass(s, p.stage)}>{STAGE_LABEL[s]}</span>
          </span>
        ))}
        {terminal ? <span className="step fail">{STAGE_LABEL[p.stage]}</span> : null}
      </div>

      {p.detail ? (
        <p className="t-caption" style={{ color: terminal ? "var(--paper)" : "var(--lichen)" }}>
          {p.detail}
        </p>
      ) : null}

      {p.hash ? (
        <p className="mono breakable" style={{ color: "var(--lichen)" }}>
          {p.hash}
        </p>
      ) : null}
    </div>
  );
}
