# Reply to the stewards' letter

Two points were raised. The first asked for a contract change and a
regression test; both are made, deployed, and proven against the live
deployment. The second asked for a stronger trust model around identity;
it is answered honestly below — what changed now, what is documented,
and what is deliberately out of MVP scope.

---

## 1. A buyer dispute against an assessed version must invalidate terms

> "Please update the contract so a buyer dispute against the assessed
> invoice version invalidates pending or effective terms and blocks
> finalization or funding until reassessment, then add a regression test
> covering a dispute filed after assessment."

Correct, and fixed as the rule it deserved to be rather than a patch:
**the obligor's repudiation outranks a verdict that never read it.**

What v0.1.2 (`0x5755D21345f0Ea0BaD1909FC320562D41c9c2aE5`, byte-verified)
does the moment `file_buyer_dispute` lands after a judgment:

- **A pending verdict loses its promotion.** `pending_version` and its
  window are cleared, the invoice lands in `REVIEW`, and the terms
  fields are zeroed. The dossier itself is preserved in the assessments
  record — effect struck, history kept.
- **Effective terms are struck.** A `FINANCEABLE` invoice whose verdict
  never saw the dispute drops to `REVIEW` with advance and fee zeroed.
- **Finalization and funding refuse.** Primary path: there is nothing
  left to finalize or fund. Defence in depth: both functions also carry
  an explicit refusal that checks the dossier's recorded
  `buyer_dispute_open` flag, declared as DEPTH in the mutation sweep —
  they exist for the day the primary path weakens.
- **A lapsed challenge cannot resurrect struck terms.** The
  challenge-lapse snapshot restore re-applies the same invalidation, so
  a stale challenge is not a route to sneak a repudiated verdict back
  into effect.
- **The way back always runs through a judgment that has read the
  dispute** — a new evidence version from the seller, or a bonded
  challenge (REVIEW joined the challengeable states so the re-judgment
  does not depend on the seller's initiative). A dispute already on the
  record when the panel runs is read by every validator and the derived
  verdict cannot conclude FINANCEABLE — that coercion predates this
  letter and stands.
- **The buyer can withdraw** (`withdraw_buyer_dispute`, new). Without
  it, one dispute made REVIEW a hold state with no honest exit.
  Withdrawal is history, not erasure: both epochs stay on-chain, the
  next panel is told the dispute was filed and withdrawn, and terms
  return only through that fresh judgment.

**Regression tests:** `tests/direct/test_dispute_invalidation.py` —
nine tests covering the exact letter scenario (dispute filed after
assessment, before and after finalization), the funded case (review
flag, money cannot unwind), the lapse-restore hole, withdrawal
boundaries, and the full strike → withdraw → re-judge → fund round
trip. Suite: 119 direct tests; mutation sweep 62/62 pinned with 7
declared-depth guards and a green accept-control.

**Proven live, not just in tests:** `web/scripts/live-dispute-regression.mjs`
ran the letter's scenario with real GEN against the character-identical
predecessor deployment (`0x0c54C840c72024c4e98c63A21B6f38F08516B507` — the
deployment ledger records why it was re-deployed as LF bytes) — the
mid-window dispute struck the pending verdict on-chain, finalize and
fund were probed and refused, and the withdrawn-and-re-judged record
finalized, funded, repaid and settled with the split conserving to the
atto. The transcript is in the README's Verified-end-to-end section.

## 2. Binding wallets and evidence to authoritative identities

> "Separately, binding buyer wallets and invoice evidence to
> authoritative identities or signed sources would strengthen the trust
> model."

Agreed — and the honest version of that agreement is to state precisely
what today's model proves, price what it does not, and name where the
stronger anchors plug in. That statement now lives in the README's
**Trust model, stated plainly** section:

- A wallet is a key, not a legal identity. The countersignature binds
  the obligation to the buyer key the seller named — the strongest fact
  in the record because the seller cannot mint it — and neither the
  contract nor the panel presents it as more. Every fence the panel
  reads is provenance-labelled: seller-declared, wallet-signed chain
  fact, or contract-fetched.
- The pricing already encodes the gap: a record whose only voice is the
  seller's caps the advance in code; the countersigned rate requires
  the buyer's own key.
- The strengthening path — registrar-anchored identity attestations and
  issuer-signed evidence sources, verified before the panel reads them
  — is deliberately out of MVP scope, and the evidence pipeline's
  frozen external URLs fetched under consensus are the socket such
  attestations would plug into.

---

Verify everything:

```bash
python scripts/verify_deployment.py 0x5755D21345f0Ea0BaD1909FC320562D41c9c2aE5
python -m pytest tests/direct -q
python scripts/mutate.py
node web/scripts/live-dispute-regression.mjs 0x5755D21345f0Ea0BaD1909FC320562D41c9c2aE5
```
