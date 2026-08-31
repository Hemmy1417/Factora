<p align="center">
  <img src="https://raw.githubusercontent.com/Hemmy1417/Factora/main/web/app/icon.svg" width="140" alt="Factora" />
</p>

# Factora - receivables, judged financeable

**Invoice factoring where a GenLayer validator panel judges the evidence behind a receivable, and deterministic contract code moves every atto of the money.**

A business is owed money through a legitimate invoice and needs the capital now. A factoring provider will advance it - if the obligation is real. That fact lives in fragmented, unstructured evidence: the invoice, the purchase order, the delivery trail, the buyer's standing, the disputes nobody mentions. No price feed can settle it. Factora commits that evidence on-chain, puts it to a validator panel that judges it under consensus, and converts the judgment into bounded financing terms through a code table the model never touches.

Live app: [factora-gen.vercel.app](https://factora-gen.vercel.app) · Contract: [`0xE2B4A382b040619779286fa808138A423B10C88a`](https://studio.genlayer.com) on GenLayer StudioNet

## What it is

- **A receivables registry with deterministic identity** - an invoice registers bound to its parties, amounts and dates; the same receivable cannot register twice.
- **Evidence as committed bytes** - documents commit as hashed canonical text, external pages as frozen URLs the contract fetches itself; versions are append-only and every assessment names the exact version it judged.
- **A financeability tribunal** - leader and validators independently read the committed record, re-fetch the frozen pages, and must agree on the decision, risk class, pillar findings, examined set, conflict codes and score bucket before anything is recorded.
- **A terms table instead of model-priced money** - the panel pins a decision and a risk class; advance and fee come from code. A record the buyer never countersigned on-chain caps the advance lower, whatever the panel thought of it.
- **Deterministic capital rails** - funding must equal the derived advance exactly, repayment is custody, and settlement is a prepared, conserving split executed once - all behind one credit choke point and one pull-payment exit.

## How it works

### For a seller

1. Register the receivable: buyer wallet, reference, amount, dates. Identity is hashed; duplicates are refused.
2. Commit evidence version 1 - the exact bytes the panel will read.
3. Invite the buyer's wallet to acknowledge the obligation on-chain (optional, but the advance table prices its absence).
4. Request assessment. The verdict arms a challenge window; promotion after it is permissionless.
5. Once funded, claim the advance. After repayment settles, claim the reserve.

### For a capital provider

1. Browse financeable receivables - each shows its verdict, risk class, examined counts, and the full evidence graph.
2. Inspect the dossier: every finding traces to committed items with digests anyone can re-check forever.
3. Fund the exact derived advance. The deposit escrows; the seller is credited.
4. On repayment, the prepared split returns your principal plus the factoring fee.

### For the buyer's wallet

1. Acknowledge the obligation - the one identity fact a seller cannot manufacture.
2. Or dispute it on-chain: an open buyer dispute is contract-verified adverse evidence, and no assessment run over it can conclude financeable.
3. Repay the invoice amount, in full, from the acknowledged wallet only.

### For anyone

Finalize lapsed verdicts, run reassessments, mark expiry and default, prepare and execute settlement, or challenge a record with a bond and new evidence. There is no operator and no owner key; every recovery path is permissionless rules.

## Decisions

| Decision | Meaning |
|---|---|
| `FINANCEABLE` | The obligation, both parties and the amounts are supported with no unresolved material contradiction. Terms come from the table. |
| `REVIEW_REQUIRED` | The record is genuinely mixed or insufficient. No terms. Also the forced landing for an open buyer dispute, HIGH risk, or a record with nothing examined. |
| `NOT_FINANCEABLE` | The record contradicts the obligation or a party. No terms. |

## Lifecycle

```text
DRAFT ──▶ COMMITTED ──▶ PENDING_FINALITY ──▶ FINANCEABLE ──▶ FUNDED ──▶ REPAID ──▶ SETTLEMENT_READY ──▶ SETTLED
             │                 │  ▲                │              │
             │        challenge│  │reassess        │              ├──▶ DEFAULTED (due + grace, honest loss)
             │                 ▼  │                ▼              │
             │            (bonded, new         EXPIRED       buyer repays
             │             evidence version,   (nobody        even late
             │             snapshot restored   funded)
             │             on lapse)
             └──▶ NOT_FINANCEABLE / REVIEW  (recommit evidence to try again)
```

| Status | Meaning |
|---|---|
| `DRAFT` | Registered, no evidence yet |
| `COMMITTED` | Evidence frozen; awaiting assessment |
| `PENDING_FINALITY` | The panel ruled; the challenge window is running; nothing has taken effect |
| `FINANCEABLE` | Verdict promoted; open for funding until the deadline |
| `NOT_FINANCEABLE` / `REVIEW` | Adverse or mixed verdict promoted; the seller may commit a new version |
| `FUNDED` | Advance escrowed and credited to the seller |
| `REPAID` | The buyer's payment sits in custody |
| `SETTLEMENT_READY` | The split is computed, conserved and frozen |
| `SETTLED` | Paid out through the claim ledger; terminal |
| `DEFAULTED` | Due date plus grace passed unpaid; late repayment still settles |
| `CANCELLED` / `EXPIRED` | Seller withdrew pre-funding / funding window lapsed |

## GenLayer consensus functions

| Function | Kind | What runs under consensus |
|---|---|---|
| `request_assessment` | write | Leader and every validator independently read the committed evidence bytes, fetch each frozen URL, and judge the three evidence pillars. **The model never returns a decision or a risk class**: deterministic code inside every validator's own judgment composes both from the pillar findings and hard conflicts, and the comparison requires those derived money fields to match exactly. Around them: pillar findings within one ladder step, hard-conflict sets exact, the examined id set exact, the score bucket within one, and the dossier rows structurally - ids in order, reachability claims, each row's digest covering the bytes that row stores, committed-document excerpts equal to the committed bytes. |
| `reassess` | write | The same panel over a challenge's appended evidence version. |
| every timed write | write | The consensus wall clock: three `cdn-cgi/trace` candidates (min taken, mutual divergence refused), an execution-layer block as corroboration, and two beacon heads bounding **both** directions. No witness, no clock - every timed method fails closed. |

The model recommends nothing in basis points and does not even name the decision: `_derive_verdict()` composes decision and risk from the findings in pure code, and `_promote()` prices the result against the terms table. The dossier's advisory copy is display-only.

## Contract

| | |
|---|---|
| Network | GenLayer StudioNet (chain `61999`) |
| Address | `0xE2B4A382b040619779286fa808138A423B10C88a` |
| Deploy tx | `0xb9bb20c4cc50ea5889e042274ef0fa5fc54d2d508d2aac7de639050794f36c04` |
| Version | `0.1.1` (read live from `get_config`) |
| Source | `contracts/factora.py` |
| Runner | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (pinned) |
| Owner / admin key | **none** - `__init__` sets four counters and nothing else |

### Write methods

| Method | Who | Payable | Notes |
|---|---|---|---|
| `create_invoice` | seller | - | deterministic identity; duplicates refused |
| `commit_evidence` | seller | - | append-only versions; walks the state back to COMMITTED |
| `acknowledge_invoice` | buyer wallet | - | the countersignature; raises the advance table |
| `file_buyer_dispute` | buyer wallet | - | contract-verified adverse evidence |
| `request_assessment` | seller | - | one judgment per version; arms the challenge window |
| `finalize_assessment` | anyone | - | permissionless promotion after the window |
| `challenge` | anyone but the seller | bond | appends evidence as the next version; snapshots what it challenges |
| `reassess` | anyone | - | executes an open challenge's panel round |
| `challenge_lapse` | anyone | - | after 1h unresolved: restores the snapshot, frees the bond |
| `fund` | any non-party | exact advance | derived from state, never caller-chosen |
| `claim_advance` | seller | - | pull-payment sugar over `claim` |
| `repay` | buyer wallet | exact amount | into custody |
| `prepare_settlement` | anyone | - | computes, conserves and freezes the split |
| `execute_settlement` | anyone | - | pays the prepared record, once |
| `claim` | anyone owed | - | the only external value path; ledger zeroes before transfer |
| `cancel_invoice` / `mark_expired` / `mark_defaulted` | seller / anyone / anyone | - | housekeeping with wall-clock guards |

### Read methods

`get_invoice`, `get_invoices` (paged), `get_invoices_for`, `get_evidence` (any version), `get_assessment` (any version), `get_claimable`, `get_stats`, `get_config` (every enforced bound).

### Consensus guarantees

- Every economically decisive field the payout math reads is computed deterministically in contract code - decision and risk are DERIVED from the panel's findings, not returned by it - and the derived values sit inside the validator equivalence set. There is no third category.
- The recorded dossier is consensus-bound, not leader-authored: validators compare the record's rows structurally, re-derive each digest from the stored bytes, and refuse committed-document excerpts that differ from the committed bytes.
- A validator whose own rerun fails disagrees rather than throwing, so a broken model rotates the round instead of discarding it.
- Deterministic coercions run inside the judged block - an open buyer dispute, HIGH risk, or an empty examined set can never emerge FINANCEABLE - so every validator lands on the identical corrected verdict.

## Verified end-to-end

The full arc below ran against the live deployment with real GEN — reproduce it with `node web/scripts/live-demo.mjs <address>`. Worth noticing in the recorded run: the panel marked the seller pillar INSUFFICIENT because the whole record was seller-declared ("a single voice"), while crediting the buyer's contract-verified countersignature — the trust model steering a real judgment — and the reassessment after the buyer's on-chain dispute dropped the record to REVIEW_REQUIRED / HIGH without touching the already-funded terms.

```text
FACTORA LIVE DEMO  ·  0xE2B4A382b040619779286fa808138A423B10C88a

1. Acme registers the receivable and commits evidence v1
  ok    registered as fac-000003  (INV-DEMO-1788183140)
  ok    evidence v1 committed  (root bc5612ae183baaec…)

2. MegaRetail's own wallet acknowledges the obligation
  ok    countersigned on-chain — the fact a seller cannot manufacture

3. The record goes to the panel (consensus round, real validators)
  ok    panel ruled: FINANCEABLE · MEDIUM · score 62
  ok    examined 4 of 4, excluded 0
  ..    findings: seller INSUFFICIENT · buyer SUPPORTED · transaction SUPPORTED
  ..    reason: The buyer's on-chain countersignature (contract-verified) is strong independent support for the buyer's identity and acknowledgement of the obligation, and the invoice amount of 100000000000000000 atto-GEN is internally consistent across EV-001 and EV-002. However, all four evidence items are seller-declared documents that corroborate one another but ultimately represent a single voice — no independent third-party verification of the seller's identity or standing exists on this record, warranting INSUFFICIENT for the seller finding. The transaction narrative (PO, delivery receipt, payment hist
  ..    window closes 2026-08-31T13:49:43.000Z

4. The walls hold while the verdict is pending
  ok    refused: funding before finality
  ok    refused: a stranger repaying

5. The challenge window lapses; promotion is permissionless
  ..    waiting 845s of real window
  ok    FINANCEABLE — advance 7000 bps, fee 500 bps (table on pinned risk)

6. The capital provider funds the derived advance exactly
  ok    refused: funding one atto short
  ok    funded with 0.070 GEN — escrowed, seller credited

7. Acme claims the advance
  ok    advance claimed — the transfer rides finalization

8. New facts: the buyer disputes on-chain; a challenger bonds evidence
  ok    buyer dispute recorded from the buyer's own wallet
  ok    challenged with a 0.050 GEN bond — evidence appended as v2
  ok    re-judged: REVIEW_REQUIRED · HIGH · score 42 (was 62)
  ok    monitoring is now REVIEW_REQUIRED; funded terms untouched (7000 bps)

9. The buyer repays; the split prepares, executes, and reconciles
  ok    repaid 0.100 GEN into custody
  ok    split prepared: provider 0.075 GEN · seller 0.025 GEN
  ok    executed — SETTLED
  ok    refused: settling twice
  ok    PROVIDER claimed 0.075 GEN
  ok    SELLER claimed 0.025 GEN
  ok    CHALLENGER claimed 0.050 GEN
  ok    custody reconciled to zero — every atto left through a claim

ARC COMPLETE  ·  fac-000003  ·  0 failures
```

Direct suite: **110 tests**. Mutation sweep: **57/57 guards pinned**, 5 declared depth, accept-control green. Web suite: **35 tests** including the signed-write proof and the live-measured finality fixtures. `genvm-lint check`: clean.

## Tech stack

| Layer | Choice |
|---|---|
| Contract | GenLayer Intelligent Contract, single file, pinned runner |
| Consensus | `gl.vm.run_nondet_unsafe` with a custom field-level validator comparison |
| Frontend | Next.js 16 App Router, TypeScript, hand-rolled CSS design system |
| Chain client | genlayer-js 1.1.8, EIP-6963 wallet discovery, provider-injected write client |
| Reads | same-origin paced proxy (StudioNet allows ~30 reads/min/IP, measured) |
| Tests | pytest direct suite, mutation sweep, vitest web suite |

## Repository

```text
factora/
├── contracts/factora.py          the intelligent contract (the only authority)
├── tests/direct/                 109 direct tests + strict genlayer stub
├── scripts/
│   ├── mutate.py                 56-guard mutation sweep + accept-control
│   └── verify_deployment.py      byte-compares live code against this source
├── web/
│   ├── app/                      the prospectus (pages + components)
│   ├── lib/                      chain, read, tx (finality-aware), wallet, predicates
│   ├── tests/                    35 vitest tests
│   └── scripts/live-demo.mjs     the reproducible end-to-end arc
└── docs/                         architecture, adjudication, deployment, security
```

## Getting started

```bash
python -m pytest tests/direct -q
```

```bash
python scripts/mutate.py
```

```bash
cd web && npm install && npm test && npm run build
```

```bash
python scripts/verify_deployment.py 0xE2B4A382b040619779286fa808138A423B10C88a
```

Run the app locally: set `web/.env.local` from the table in `docs/DEPLOYMENT.md`, then `npm run dev`.

## Security

- One credit choke point (`_credit`) and one external value path (`claim`); the ledger zeroes before the transfer is emitted; custody is deposits minus claims and reconciles to zero when a book closes.
- Reserve-at-acceptance is not needed: there is no shared pool - each position escrows its own advance, and the split is conserved by assertion before it is stored.
- Prompt-injection surface: both fence delimiters are sanitized out of every party string and fetched page; URLs are printable-ASCII with the header-forging characters refused; a forged fence arrives visibly defused and weighs against its supplier.
- The subject of the judgment does not control its strongest identity evidence: the buyer countersignature and the buyer dispute are signed by the buyer's own wallet, and declared-only records cap the advance in code.
- Challenges snapshot what they challenge; a lapse restores exactly that snapshot; an unresolved challenge has a permissionless wall-clock exit.
- Known limitation, stated: the MVP holds no seller collateral, so a default records the provider's loss - it cannot manufacture a recovery. Off-chain document authenticity (a forged PDF pasted as text) is bounded by the countersignature cap, not solved.

## Design notes

- The UI is a bioluminescent laboratory at midnight (from a supplied style reference): near-black canvas with a green undertone, a single weight of Inter Tight carved by size and negative tracking - never boldness - Roboto Mono as the lab-notebook voice, hairline borders for all depth, and one lime signal rationed to micro-surfaces: tag dots, active pills, the score ring.
- "Accepted" and "Finalized" are two different words in the transaction stepper, with two different proofs behind them - a state read for the first, `FINALIZED` status plus a successful deciding leader receipt for the second.
- Tailwind and shadcn/ui were deliberately skipped: the design system is ~500 lines of CSS custom properties, and a component kit's look would have fought the single-weight discipline.

## Disclaimer

Factora is a hackathon build on GenLayer StudioNet. The GEN it moves is testnet value; the receivables are demonstrations. It is not a lending product, not investment advice, and not audited beyond its own test suite and mutation sweep.
