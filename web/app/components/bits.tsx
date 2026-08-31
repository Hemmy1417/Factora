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
