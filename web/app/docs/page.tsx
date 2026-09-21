import { CONTRACT_ADDRESS } from "@/lib/config";

/** The rules, stated the way the contract enforces them. */
export default function DocsPage() {
  return (
    <div style={{ maxWidth: 780 }}>
      <h1 className="v-display" style={{ fontSize: 34 }}>The rules</h1>
      <p className="v-body" style={{ marginTop: 8 }}>
        Everything below is a property of the contract, not a promise of this
        page. The contract is the authority; this page only translates.
      </p>

      <div className="section-head">
        <span className="section-no">01</span>
        <h2>Who does what</h2>
      </div>
      <div className="sheet">
        <dl className="defs">
          <div className="def-row">
            <dt>The seller</dt>
            <dd style={{ textAlign: "right", maxWidth: 380 }}>
              registers the receivable, commits evidence versions, names its
              legal entity in the public register, requests assessment, claims
              the advance and the reserve
            </dd>
          </div>
          <div className="def-row">
            <dt>The buyer&apos;s wallet</dt>
            <dd style={{ textAlign: "right", maxWidth: 380 }}>
              may countersign the obligation, name its own legal entity,
              dispute the invoice or contest part of it on-chain, and is the
              only wallet the contract accepts repayment from
            </dd>
          </div>
          <div className="def-row">
            <dt>The capital provider</dt>
            <dd style={{ textAlign: "right", maxWidth: 380 }}>
              deposits exactly the derived advance; repayment returns the
              advance plus the factoring fee
            </dd>
          </div>
          <div className="def-row">
            <dt>Anyone</dt>
            <dd style={{ textAlign: "right", maxWidth: 380 }}>
              finalizes lapsed verdicts, runs reassessments, marks expiry and
              default, prepares and executes settlement, challenges with a
              bond — the protocol has no operator and no owner key
            </dd>
          </div>
        </dl>
      </div>

      <div className="section-head">
        <span className="section-no">02</span>
        <h2>The terms table</h2>
      </div>
      <div className="sheet">
        <p className="v-body" style={{ fontSize: 13.5 }}>
          The panel pins a decision and a risk class; money reads only this
          table. There is no basis point anywhere a model can choose.
        </p>
        <div className="sheet-recessed v-mono" style={{ whiteSpace: "pre", overflowX: "auto", marginTop: 10 }}>
{`                  both on the register    wallet keys only    not countersigned    fee
LOW risk          85%                     75%                 60%                  3%
MEDIUM risk       70%                     60%                 50%                  5%
HIGH risk         not financeable: coerced to review in the judged block`}
        </div>
        <p className="v-body" style={{ fontSize: 13.5, marginTop: 12 }}>
          The first column needs the buyer&apos;s countersignature and both
          parties confirmed by the public register of legal entities. A party
          names only its identifier. The contract decides where to look it up,
          every validator reads the record itself, and the panel checks that it
          names the same party the documents do. This shows the company exists
          and is the one on the invoice. It does not show that the wallet
          belongs to that company, and the table does not pretend it does.
        </p>
        <p className="v-body" style={{ fontSize: 13.5, marginTop: 8 }}>
          If the buyer contests part of an invoice, that part is never
          financed, and both the advance and the fee are worked out on the
          rest. The buyer owes the reduced amount only when the panel finds the
          claim supported by an item in the record. The buyer&apos;s word alone
          does not reduce the debt.
        </p>
      </div>

      <div className="section-head">
        <span className="section-no">03</span>
        <h2>Windows and escapes</h2>
      </div>
      <div className="sheet">
        <dl className="defs">
          <div className="def-row">
            <dt>Challenge window</dt>
            <dd style={{ textAlign: "right", maxWidth: 380 }}>
              set per invoice (15 min – 7 days); every verdict waits it out
              before taking effect
            </dd>
          </div>
          <div className="def-row">
            <dt>Challenge bond</dt>
            <dd style={{ textAlign: "right", maxWidth: 380 }}>
              5% of face, 0.05 GEN floor — returned when the reassessment
              changes the decision or risk, forfeited to the burdened party
              otherwise
            </dd>
          </div>
          <div className="def-row">
            <dt>Stale challenge</dt>
            <dd style={{ textAlign: "right", maxWidth: 380 }}>
              after 1 hour unresolved, anyone restores the snapshot taken at
              filing and frees the bond — nothing is hostage to a round that
              never lands
            </dd>
          </div>
          <div className="def-row">
            <dt>Default</dt>
            <dd style={{ textAlign: "right", maxWidth: 380 }}>
              one day after the due date anyone may record it. The buyer can
              still repay at any time, which ends the matter. No seller
              collateral is held, and the protocol does not pretend otherwise
            </dd>
          </div>
          <div className="def-row">
            <dt>Who answers for a default</dt>
            <dd style={{ textAlign: "right", maxWidth: 380 }}>
              the seller, the buyer and the provider may each file their
              account, and a panel rules: the buyer did not pay a valid debt,
              or the invoice was not what the seller declared, or the record
              does not settle it. Nobody is found liable on their
              opponent&apos;s paper alone. A ruling waits out the challenge
              window, and a finding stays on the wallet, raising the risk on
              its other invoices, until it is paid
            </dd>
          </div>
        </dl>
      </div>

      <div className="section-head">
        <span className="section-no">04</span>
        <h2>The contract</h2>
      </div>
      <div className="sheet">
        <dl className="defs">
          <div className="def-row">
            <dt>Network</dt>
            <dd>GenLayer StudioNet (chain 61999)</dd>
          </div>
          <div className="def-row">
            <dt>Address</dt>
            <dd className="v-mono breakable">{CONTRACT_ADDRESS || "not configured"}</dd>
          </div>
          <div className="def-row">
            <dt>Owner key</dt>
            <dd>none — every recovery path is permissionless rules</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
