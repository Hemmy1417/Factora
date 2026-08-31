import Link from "next/link";

/** The cover page of the prospectus. */
export default function Landing() {
  return (
    <div>
      <div style={{ maxWidth: 780, margin: "24px auto 0", textAlign: "center" }}>
        <div className="v-label" style={{ color: "var(--leaf)" }}>
          Receivables finance · GenLayer StudioNet
        </div>
        <h1 className="v-display" style={{ fontSize: 52, marginTop: 14 }}>
          An invoice is worth what its
          <em style={{ fontStyle: "italic" }}> evidence </em>
          can prove.
        </h1>
        <p className="v-body" style={{ margin: "18px auto 0" }}>
          A business is owed money and needs it now. A capital provider will
          advance it — if the obligation is real. That fact lives in
          fragmented, unstructured evidence no price feed can settle. Factora
          commits that evidence on-chain, puts it to a GenLayer validator
          panel that judges it under consensus, and lets deterministic
          contract code — never the model — move every atto of the money.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26 }}>
          <Link href="/create" className="btn" style={{ textDecoration: "none" }}>
            Register a receivable
          </Link>
          <Link href="/market" className="btn btn-quiet" style={{ textDecoration: "none" }}>
            Browse the marketplace
          </Link>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 72 }}>
        <span className="section-no">01</span>
        <h2>Proof → finance → settlement</h2>
      </div>
      <div className="grid-3">
        <div className="sheet">
          <div className="v-label">Commit</div>
          <h3 className="v-display" style={{ fontSize: 20, marginTop: 6 }}>
            Evidence becomes bytes
          </h3>
          <p className="v-body" style={{ fontSize: 13.5 }}>
            Documents commit as hashed canonical text; external pages freeze
            as urls the contract fetches itself. Versions are append-only —
            nothing is ever overwritten, and every assessment names the exact
            version it judged. The buyer&apos;s own wallet can countersign the
            obligation: the one identity fact a seller cannot manufacture.
          </p>
        </div>
        <div className="sheet">
          <div className="v-label">Judge</div>
          <h3 className="v-display" style={{ fontSize: 20, marginTop: 6 }}>
            A panel, not a price feed
          </h3>
          <p className="v-body" style={{ fontSize: 13.5 }}>
            Leader and validators independently read the committed record and
            re-fetch the frozen pages, then must agree on the decision, the
            risk class, three pillar findings, the examined set and the
            conflict codes. The verdict arms a challenge window before it
            takes effect; a bond and new evidence genuinely re-run it.
          </p>
        </div>
        <div className="sheet">
          <div className="v-label">Settle</div>
          <h3 className="v-display" style={{ fontSize: 20, marginTop: 6 }}>
            Money is arithmetic
          </h3>
          <p className="v-body" style={{ fontSize: 13.5 }}>
            The model recommends nothing in basis points. Terms come from a
            code table on the pinned fields, funding must equal the derived
            advance exactly, and settlement is a two-step prepared split that
            conserves every atto — proven by the test suite, reconciled to
            zero on-chain.
          </p>
        </div>
      </div>

      <div className="section-head">
        <span className="section-no">02</span>
        <h2>The lifecycle, printed</h2>
      </div>
      <div className="sheet-recessed v-mono" style={{ whiteSpace: "pre", overflowX: "auto", padding: 24, fontSize: 12.5, lineHeight: 1.7 }}>
{`REGISTER ──▶ COMMIT EVIDENCE ──▶ PANEL JUDGES ──▶ window ──▶ FINANCEABLE
                                     │                            │
                                     │  challenge + bond          ▼
                                     ◀── new version ◀──────── FUNDED ──▶ advance to seller
                                                                  │
                                                     buyer repays ▼
                                              PREPARE ──▶ EXECUTE SETTLEMENT
                                              provider: advance + fee
                                              seller:   reserve − fee`}
      </div>

      <div className="section-head">
        <span className="section-no">03</span>
        <h2>What the panel is told about trust</h2>
      </div>
      <div className="grid-2">
        <div className="sheet">
          <div className="stamp tone-good">contract-verified</div>
          <p className="v-body" style={{ fontSize: 13.5, marginTop: 10 }}>
            The buyer&apos;s on-chain acknowledgement and any on-chain payment
            dispute are signed by the buyer&apos;s own wallet. Pages the
            contract fetches arrive under consensus. These carry weight of
            their own.
          </p>
        </div>
        <div className="sheet">
          <div className="stamp tone-neutral">party-declared</div>
          <p className="v-body" style={{ fontSize: 13.5, marginTop: 10 }}>
            Every committed document is the seller&apos;s submission — hashed
            and frozen, tamper-evident, but a claim rather than a verified
            fact. The panel is instructed to weigh it exactly that way, and
            an unacknowledged record caps the advance rate in code, whatever
            the panel thinks of it.
          </p>
        </div>
      </div>
    </div>
  );
}
