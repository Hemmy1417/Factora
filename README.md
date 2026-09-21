<p align="center">
  <img src="https://raw.githubusercontent.com/Hemmy1417/Factora/main/web/app/icon.svg" width="140" alt="Factora" />
</p>

# Factora - receivables, judged financeable

**Invoice factoring where a GenLayer validator panel judges the evidence behind a receivable, and deterministic contract code moves every atto of the money.**

A business is owed money through a legitimate invoice and needs the capital now. A factoring provider will advance it - if the obligation is real. That fact lives in fragmented, unstructured evidence: the invoice, the purchase order, the delivery trail, the buyer's standing, the disputes nobody mentions. No price feed can settle it. Factora commits that evidence on-chain, puts it to a validator panel that judges it under consensus, and converts the judgment into bounded financing terms through a code table the model never touches.

Live app: [factora-gen.vercel.app](https://factora-gen.vercel.app) · Contract: [`0x117b03D79063F4aE882bA16B17398f4Dd49814e1`](https://explorer-studio.genlayer.com/address/0x117b03D79063F4aE882bA16B17398f4Dd49814e1) on GenLayer StudioNet

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
4. Name your legal entity by its identifier in the public LEI register, and invite the buyer to do the same. The contract looks each record up itself. When both are confirmed and the buyer has countersigned, the top advance table applies.
5. Request assessment. The verdict arms a challenge window; promotion after it is permissionless.
6. Once funded, claim the advance. After repayment settles, claim the reserve.

### For a capital provider

1. Browse financeable receivables - each shows its verdict, risk class, examined counts, and the full evidence graph.
2. Inspect the dossier: every finding traces to committed items with digests anyone can re-check forever.
3. Fund the exact derived advance. The deposit escrows; the seller is credited.
4. On repayment, the prepared split returns your principal plus the factoring fee.

### For the buyer's wallet

1. Acknowledge the obligation - the one identity fact a seller cannot manufacture.
2. Or dispute it on-chain: an open buyer dispute is contract-verified adverse evidence, no assessment run over it can conclude financeable, and a dispute filed AFTER a judgment strikes that judgment's effect - pending or effective terms are invalidated and finalization and funding stay blocked until a reassessment reads the dispute.
3. Withdraw a dispute resolved off-chain. Withdrawal is history, not erasure: the next panel is told a dispute was filed and withdrawn, and terms return only through a fresh judgment.
4. Contest PART of the invoice - a short delivery, a credit note - without denying the rest. The contested part stops being financed the moment the claim is filed; a judgment decides whether it is still owed. Like a dispute, a claim filed after a judgment strikes that judgment's effect, and it can be withdrawn.
5. Name your own legal entity in the public register (see the seller's step 4).
6. Repay the amount owed under the effective judgment, in full, from the buyer wallet only.

### For anyone

Finalize lapsed verdicts, run reassessments, mark expiry and default, prepare and execute settlement, or challenge a record with a bond and new evidence. There is no operator and no owner key; every recovery path is permissionless rules.

## Decisions

| Decision | Meaning |
|---|---|
| `FINANCEABLE` | The obligation, both parties and the amounts are supported with no unresolved material contradiction. Terms come from the table. |
| `REVIEW_REQUIRED` | The record is genuinely mixed or insufficient. No terms. Also the forced landing for an open buyer dispute, a party the public register contradicts, HIGH risk, or a record with nothing examined. |
| `NOT_FINANCEABLE` | The record contradicts the obligation or a party. No terms. |

### The advance table

Money reads two pinned fields, decision and risk, and two facts the contract can stand behind: the buyer's countersignature, and the identity classes a judged round recorded.

| Record | LOW risk | MEDIUM risk |
|---|---|---|
| Countersigned, and both parties confirmed by the public register | 85% | 70% |
| Countersigned, identity resting on wallet keys | 75% | 60% |
| Not countersigned | 60% | 50% |

Fees are 3% (LOW) and 5% (MEDIUM). Advance and fee are both computed on the financed base: the invoice, less any part the buyer has contested.

### The identity ladder

A party names an identifier and nothing else. The contract composes the register's address from a fixed table, every validator fetches the record itself, and the class is derived in code.

| Class | When |
|---|---|
| `NONE` | the party attested nothing |
| `DECLARED` | attested, but the register could not be read, the registration is not current, or the documents do not name the party well enough to tell |
| `REGISTERED` | the register's record is active and current, and the panel found it names the same party the committed documents do |
| `CONTRADICTED` | the register says the entity is not active, or the panel found the documents name a different party. Holds the record at review. |

### The contested part

| Panel finding on the claim | Financed | Owed by the buyer |
|---|---|---|
| `SUPPORTED`, with an examined item behind it | invoice less the claim | invoice less the claim |
| `INSUFFICIENT` | invoice less the claim | the full invoice |
| `NOT_SUPPORTED`, with an examined item behind it | invoice less the claim, one risk class worse | the full invoice |

A `SUPPORTED` or `NOT_SUPPORTED` finding with no examined item named behind it falls to `INSUFFICIENT` in code: the buyer's word alone cannot cut the debt, and the seller's silence alone cannot mark the buyer as contesting against the evidence.

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
| Address | `0x117b03D79063F4aE882bA16B17398f4Dd49814e1` |
| Deploy tx | `0x662a870268c57322a447bededcdcdf9b8893f58d9245f8d6bae74c4eae258b77` |
| Version | `0.2.0` (read live from `get_config`) |
| Source | `contracts/factora.py` |
| Runner | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (pinned) |
| Owner / admin key | **none** - `__init__` sets four counters and nothing else |

### Write methods

| Method | Who | Payable | Notes |
|---|---|---|---|
| `create_invoice` | seller | - | deterministic identity; duplicates refused |
| `commit_evidence` | seller | - | append-only versions; walks the state back to COMMITTED |
| `acknowledge_invoice` | buyer wallet | - | the countersignature; raises the advance table |
| `file_buyer_dispute` | buyer wallet | - | contract-verified adverse evidence; strikes any judgment that never read it |
| `withdraw_buyer_dispute` | buyer wallet | - | ends the dispute, keeps its history |
| `file_credit_claim` | buyer wallet | - | contests part of the invoice; that part is never financed; strikes any judgment that never read it |
| `withdraw_credit_claim` | buyer wallet | - | ends the claim, keeps its history |
| `attest_entity` | seller or buyer, each for itself | - | one identifier per party, check digits verified in code, register chosen from a fixed table, written once |
| `request_assessment` | seller | - | one judgment per version; arms the challenge window |
| `finalize_assessment` | anyone | - | permissionless promotion after the window |
| `challenge` | anyone but the seller | bond | appends evidence as the next version; snapshots what it challenges |
| `reassess` | anyone | - | executes an open challenge's panel round |
| `challenge_lapse` | anyone | - | after 1h unresolved: restores the snapshot, frees the bond |
| `fund` | any non-party | exact advance | derived from state, never caller-chosen |
| `claim_advance` | seller | - | pull-payment sugar over `claim` |
| `repay` | buyer wallet | exact amount owed | into custody |
| `prepare_settlement` | anyone | - | computes, conserves and freezes the split |
| `execute_settlement` | anyone | - | pays the prepared record, once |
| `claim` | anyone owed | - | the only external value path; ledger zeroes before transfer |
| `cancel_invoice` / `mark_expired` / `mark_defaulted` | seller / anyone / anyone | - | housekeeping with wall-clock guards |

### Read methods

`get_invoice`, `get_invoices` (paged), `get_invoices_for`, `get_evidence` (any version), `get_assessment` (any version), `get_claimable`, `get_stats`, `get_config` (every enforced bound).

### Consensus guarantees

- Every economically decisive field the payout math reads is computed deterministically in contract code - decision and risk are DERIVED from the panel's findings, not returned by it - and the derived values sit inside the validator equivalence set. There is no third category.
- The recorded dossier is consensus-bound, not leader-authored: validators compare the record's rows structurally, re-derive each digest from the stored bytes, and refuse committed-document excerpts that differ from the committed bytes.
- Every byte of a fetched page that enters the record is text the validator fetched itself: the leader's excerpt must be a prefix of, or equal to, the validator's own. An honest page with a fabricated ending, sealed by a correct digest, finds no validator. The price is stated: a leader whose render ran longer than a validator's is refused too, and the round is run again.
- Register records are bound more tightly still. Each node keeps the same canonical subset of the record (name, status, jurisdiction, address) and drops the response's volatile envelope, so the stored bytes must be EQUAL across nodes, and identity classes and the claim finding are compared exactly because they steer money.
- Codes the contract owns (`ENTITY_CONTRADICTED`, `CREDIT_CLAIM_CONTRADICTED`) are derived in code from a compared finding. A model cannot raise one by naming it or drop one by leaving it out.
- A validator whose own rerun fails disagrees rather than throwing, so a broken model rotates the round instead of discarding it.
- Deterministic coercions run inside the judged block - an open buyer dispute, HIGH risk, or an empty examined set can never emerge FINANCEABLE - so every validator lands on the identical corrected verdict.
- The obligor's repudiation outranks a verdict that never read it: a buyer dispute filed after a judgment deterministically strikes that judgment's effect - a pending verdict loses its promotion, effective terms are zeroed, funding and finalization refuse - and a lapsed challenge re-applies the same rule so a snapshot restore cannot resurrect struck terms. The dossier itself is preserved; only its authority is gone.

## Verified end-to-end

The stewards' regression — a buyer dispute filed AFTER the panel ruled — ran
against the live v0.1.2 deployment with real GEN: the mid-window dispute
struck the pending verdict on-chain, finalization and funding were probed and
refused, withdrawal restored nothing by itself, and the re-judged record
(panel reasoning about the resolution memo and the withdrawn dispute)
finalized, funded, repaid and settled with the split conserving to the atto.
Reproduce it with `node web/scripts/live-dispute-regression.mjs <address>`.

```text
FACTORA DISPUTE-INVALIDATION REGRESSION  ·  0x5755D21345f0Ea0BaD1909FC320562D41c9c2aE5

1. Register, commit v1, countersign, and put it to the panel
  ok    registered as fac-000001  (INV-DEMO-1788356922)
  ok    evidence v1 committed and countersigned on-chain
  ok    panel ruled on v1: FINANCEABLE · MEDIUM · score 78

2. Mid-window, the buyer's wallet disputes — the verdict must fall
  ok    pending verdict struck: nothing awaits promotion
  ok    terms zeroed — no table row prices a repudiated record
  ok    the v1 dossier is preserved — effect struck, history kept

3. Finalization and funding are probed and must refuse
  ok    refused: finalize over the struck verdict
  ok    refused: funding the struck verdict

4. The buyer withdraws; v2 goes back to the panel with the history
  ok    withdrawal does not resurrect terms — only a judgment can
GenLayer RPC error (gen_call): fetch failed
  ok    panel ruled on v2: FINANCEABLE · LOW · score 95
  ok    the v2 dossier records the dispute as filed-and-withdrawn history
  ..    reason: The transaction is strongly supported by the buyer's on-chain acknowledgement of the 0.100 GEN obligation and EV-003 confirming receipt of goods. While a quality issue occurred, EV-005 confirms resolution and the withdrawal of any dispute, leaving the original invoice amount valid and due. EV-004 further supports the finding through a clean historical payment record between the two parties.

5. Window lapses → finalize → fund → repay → settle → reconcile
  ..    waiting 806s for the real challenge window
  ok    FINANCEABLE: advance 8500 bps · fee 300 bps
  ok    funded with the exact derived advance  (0.085 GEN)
  ok    the prepared split conserves the repayment to the atto
  FAIL  timed out waiting: both parties drained their claimables

ARC ABORTED at: both parties drained their claimables
```

Two honesty notes. The transcript's header shows `0x0c54C840…B507`: the
arc ran and settled on the immediate predecessor deployment, which was
character-identical to this source but carried CRLF line endings (the
ledger in docs/DEPLOYMENT.md tells that story); the current address is the
same characters deployed as LF, with the verifier now refusing CR bytes
outright. And on the final line: the arc had spent most of an hour of
StudioNet's per-IP read budget by its last check, and the harness's poll
timed out against the rate limiter — the chain state it was waiting for was
already true. Verified directly afterwards:

```text
fac-000001  status SETTLED · settled_epoch 1788358129
claimable  seller 0 · buyer 0 · provider 0
stats      {"invoices":1,"funded":1,"settled":1,"escrow_atto":"0"}
```

The previous full lifecycle arc (assessment on a single-voice record capping
the seller pillar, funding, a post-funding dispute flipping monitoring
without touching funded terms, settlement to custody zero) remains recorded
on v0.1.1 at `0xE2B4A382b040619779286fa808138A423B10C88a` — instruments do
not migrate, and its transcript lives in that deployment's git history.

Test gates behind the transcript: 119 direct tests (nine of them the
dispute-invalidation regressions), a 62/62 mutation sweep with 7
declared-depth guards and a green accept-control, 35 frontend tests,
genvm-lint clean.

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
python scripts/verify_deployment.py 0x117b03D79063F4aE882bA16B17398f4Dd49814e1
```

Run the app locally: set `web/.env.local` from the table in `docs/DEPLOYMENT.md`, then `npm run dev`.

## Security

- One credit choke point (`_credit`) and one external value path (`claim`); the ledger zeroes before the transfer is emitted; custody is deposits minus claims and reconciles to zero when a book closes.
- Reserve-at-acceptance is not needed: there is no shared pool - each position escrows its own advance, and the split is conserved by assertion before it is stored.
- Prompt-injection surface: both fence delimiters are sanitized out of every party string and fetched page; URLs are printable-ASCII with the header-forging characters refused; a forged fence arrives visibly defused and weighs against its supplier.
- The subject of the judgment does not control its strongest identity evidence: the buyer countersignature and the buyer dispute are signed by the buyer's own wallet, and declared-only records cap the advance in code.
- Challenges snapshot what they challenge; a lapse restores exactly that snapshot - then re-applies the dispute-invalidation rule, so a stale challenge is not a way to sneak a repudiated verdict back into effect - and an unresolved challenge has a permissionless wall-clock exit.
- Known limitation, stated: the MVP holds no seller collateral, so a default records the provider's loss - it cannot manufacture a recovery. Off-chain document authenticity (a forged PDF pasted as text) is bounded by the countersignature cap, not solved.

### Trust model, stated plainly

- Wallets are keys, not legal identities. The buyer countersignature proves the obligation is acknowledged by whoever holds the buyer key the seller named at registration - it binds the debt to a key, and it is the strongest fact in the record precisely because the seller cannot mint it. It does not prove the key belongs to "MegaRetail Ltd", and neither the contract nor the panel pretends it does: every committed document reaches the panel labelled as the seller's declaration, the countersignature and dispute as wallet-signed chain facts, and fetched pages as contract-retrieved.
- The table prices that honesty: a record whose only voice is the seller's caps the advance in code, countersigned records earn the full rate, and identity findings the panel returns are about coherence of the record, never about legal personhood.
- v0.2.0 takes the first step on the path this section used to describe as future work. Each party's own wallet names its legal entity by identifier; the contract, not the party, chooses where to look it up; every validator reads the register itself; and the top advance table is reserved for a record where both parties are confirmed. What that proves: the entity exists, is active, and is the party the committed documents name. What it does not prove: that the wallet belongs to that entity. A seller who controls a second wallet can still name a real company's identifier for it, and the register will confirm the company, not the key. The register has no field that binds an identifier to a wallet, so this build does not pretend to close that gap; it prices the part it can verify and says so.
- Still out of scope: signed evidence sources (documents carrying their issuer's signature, verified in code before the panel reads them), and verifiable credentials that bind an identifier to a key.

## Design notes

- The UI is a bioluminescent laboratory at midnight (from a supplied style reference): near-black canvas with a green undertone, a single weight of Inter Tight carved by size and negative tracking - never boldness - Roboto Mono as the lab-notebook voice, hairline borders for all depth, and one lime signal rationed to micro-surfaces: tag dots, active pills, the score ring.
- "Accepted" and "Finalized" are two different words in the transaction stepper, with two different proofs behind them - a state read for the first, `FINALIZED` status plus a successful deciding leader receipt for the second.
- Tailwind and shadcn/ui were deliberately skipped: the design system is ~500 lines of CSS custom properties, and a component kit's look would have fought the single-weight discipline.

## Disclaimer

Factora is a hackathon build on GenLayer StudioNet. The GEN it moves is testnet value; the receivables are demonstrations. It is not a lending product, not investment advice, and not audited beyond its own test suite and mutation sweep.
