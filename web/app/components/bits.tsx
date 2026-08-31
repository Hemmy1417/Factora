"use client";

import { useState } from "react";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/taxonomy";

export function StatusStamp({ status, tilted = false }: { status: string; tilted?: boolean }) {
  return (
    <span className={`stamp ${STATUS_TONE[status] ?? "tone-neutral"}${tilted ? " tilted" : ""}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function MonoRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="def-row">
      <dt>{label}</dt>
      <dd style={{ display: "inline-flex", gap: 8, alignItems: "baseline", minWidth: 0 }}>
        <span className="v-mono breakable">{value || "—"}</span>
        {value ? (
          <button
            className="copy-btn"
            onClick={() => {
              void navigator.clipboard?.writeText(value).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              });
            }}
          >
            {copied ? "copied" : "copy"}
          </button>
        ) : null}
      </dd>
    </div>
  );
}

export function Problem({ text }: { text: string }) {
  if (!text) return null;
  return <p className="note bad">{text}</p>;
}

/**
 * The instrument's seal — a deterministic pastel stamp derived from its id,
 * numbered like a stamping machine. Identity reads as a mark, not a hash;
 * the raw identifiers live in the record fold where copy buttons make them
 * useful instead of decorative.
 */
export function InstrumentGlyph({ id, size = 44 }: { id: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  const n = id.replace(/^\D+0*/, "") || "?";
  return (
    <span
      className="glyph-seal"
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * (n.length > 2 ? 0.3 : 0.38),
        background: `hsl(${h} 60% 82%)`,
        color: `hsl(${h} 55% 24%)`,
        border: `1.5px dashed hsl(${h} 45% 45%)`,
      }}
    >
      {n}
    </span>
  );
}
