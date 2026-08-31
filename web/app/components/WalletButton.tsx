"use client";

import { useState } from "react";
import { truncAddr } from "@/lib/chain";
import { useWallet } from "@/lib/wallet";

/** Connect / identity control. EIP-6963 discovery — every injected wallet is
 * offered by name; nothing hardcodes a single vendor. */
export function WalletButton() {
  const w = useWallet();
  const [open, setOpen] = useState(false);

  if (w.address) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        {!w.chainOk ? (
          <button className="btn btn-quiet" onClick={() => void w.switchNetwork()}>
            Switch to StudioNet
          </button>
        ) : null}
        <button
          className="btn btn-quiet"
          onClick={w.disconnect}
          title="Disconnect"
        >
          <span className="v-mono">{truncAddr(w.address)}</span>
        </button>
      </span>
    );
  }

  return (
    <span style={{ position: "relative" }}>
      <button
        className="btn"
        disabled={w.connecting}
        onClick={() => {
          if (w.wallets.length === 1) void w.connect(w.wallets[0]);
          else setOpen((v) => !v);
        }}
      >
        {w.connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {open && w.wallets.length !== 1 ? (
        <span
          className="sheet"
          style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)",
            display: "grid", gap: 6, minWidth: 220, zIndex: 50, padding: 12,
          }}
        >
          {w.wallets.length === 0 ? (
            <span className="v-body" style={{ fontSize: 13 }}>
              No injected wallet announced itself. Install one, then reload.
            </span>
          ) : (
            w.wallets.map((d) => (
              <button
                key={d.info.uuid}
                className="btn btn-quiet"
                onClick={() => {
                  setOpen(false);
                  void w.connect(d);
                }}
              >
                {d.info.name}
              </button>
            ))
          )}
        </span>
      ) : null}
      {w.error ? (
        <span className="problem" style={{ fontSize: 12 }}>{w.error}</span>
      ) : null}
    </span>
  );
}
