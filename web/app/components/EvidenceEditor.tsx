"use client";

/**
 * The evidence composer, shared by first commitment and re-commitment.
 * Validates against the bounds the CONTRACT reports (get_config), so the
 * form refuses exactly what the chain would refuse — no guessed limits.
 */
import { useEffect, useState } from "react";
import { getConfig } from "@/lib/read";
import type { ChainConfig } from "@/lib/types";
import { EVIDENCE_TYPE_LABEL, PROVENANCE_NOTE } from "@/lib/taxonomy";

export type DraftItem = { type: string; label: string; content: string; url: string };

export function blank(): DraftItem {
  return { type: "invoice", label: "", content: "", url: "" };
}

export function itemProblem(it: DraftItem, cfg: ChainConfig | null): string {
  if (!cfg) return "";
  if (!it.label.trim()) return "Give this item a label.";
  if (it.label.length > cfg.label_chars[1]) {
    return `Labels cap at ${cfg.label_chars[1]} characters.`;
  }
  if (it.type === "external_url") {
    if (!/^https?:\/\/[\x21-\x7e]+$/.test(it.url) || /[<>"'`|]/.test(it.url)) {
      return "External items need a plain https url — ASCII, no quotes or pipes.";
    }
    if (it.url.length > cfg.url_chars[1]) {
      return `URLs cap at ${cfg.url_chars[1]} characters.`;
    }
    if (it.content.trim()) return "A url item carries no pasted content.";
    return "";
  }
  const len = it.content.trim().length;
  if (len < cfg.item_chars[0] || len > cfg.item_chars[1]) {
    return `Document text must be ${cfg.item_chars[0]}–${cfg.item_chars[1]} characters.`;
  }
  return "";
}

export function EvidenceEditor({
  items, onChange, min, max,
}: {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  min?: number;
  max?: number;
}) {
  const [cfg, setCfg] = useState<ChainConfig | null>(null);
  useEffect(() => {
    void getConfig().then(setCfg).catch(() => setCfg(null));
  }, []);

  const lo = min ?? cfg?.items[0] ?? 2;
  const hi = max ?? cfg?.items[1] ?? 8;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p className="marginalia">{PROVENANCE_NOTE}</p>
      {items.map((it, i) => {
        const problem = itemProblem(it, cfg);
        return (
          <div key={i} className="sheet" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="v-mono" style={{ color: "var(--leaf)" }}>
                EV-{String(i + 1).padStart(3, "0")}
              </span>
              <select
                value={it.type}
                style={{ maxWidth: 220 }}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...it, type: e.target.value };
                  onChange(next);
                }}
              >
                {Object.entries(EVIDENCE_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              {items.length > lo ? (
                <button
                  className="btn btn-danger"
                  style={{ marginLeft: "auto", padding: "4px 12px" }}
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="field">
              <label>Label</label>
              <input
                type="text"
                value={it.label}
                placeholder="Invoice INV-2026-014"
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...it, label: e.target.value };
                  onChange(next);
                }}
              />
            </div>
            {it.type === "external_url" ? (
              <div className="field">
                <label>URL — the contract fetches this itself, under consensus</label>
                <input
                  type="text"
                  value={it.url}
                  placeholder="https://…"
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, url: e.target.value.trim() };
                    onChange(next);
                  }}
                />
              </div>
            ) : (
              <div className="field">
                <label>Document text — committed on-chain, hashed, frozen</label>
                <textarea
                  rows={5}
                  value={it.content}
                  placeholder="Paste the document's text. It becomes the exact bytes the panel reads."
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, content: e.target.value };
                    onChange(next);
                  }}
                />
              </div>
            )}
            {problem ? <span className="problem">{problem}</span> : null}
          </div>
        );
      })}
      {items.length < hi ? (
        <button className="btn btn-quiet" onClick={() => onChange([...items, blank()])}>
          Add an evidence item
        </button>
      ) : null}
    </div>
  );
}

export function toItemsJson(items: DraftItem[]): string {
  return JSON.stringify(items.map((it) => ({
    type: it.type,
    label: it.label.trim(),
    ...(it.type === "external_url"
      ? { url: it.url.trim() }
      : { content: it.content.trim() }),
  })));
}
