<p align="center">
  <img src="https://raw.githubusercontent.com/Hemmy1417/Factora/main/web/app/icon.svg" width="140" alt="Factora" />
</p>

# Factora - receivables, judged financeable

**Invoice factoring where a GenLayer validator panel judges the evidence behind a receivable, and deterministic contract code moves every atto of the money.**

A business is owed money through a legitimate invoice and needs the capital now. A factoring provider will advance it - if the obligation is real. That fact lives in fragmented, unstructured evidence: the invoice, the purchase order, the delivery trail, the buyer's standing, the disputes nobody mentions. No price feed can settle it. Factora commits that evidence on-chain, puts it to a validator panel that judges it under consensus, and converts the judgment into bounded financing terms through a code table the model never touches.

Live app: [factora-gen.vercel.app](https://factora-gen.vercel.app) · Contract: [`0xF9bF8e95d61e90b6077A40c344121890ED2D62e3`](https://explorer-studio.genlayer.com/address/0xF9bF8e95d61e90b6077A40c344121890ED2D62e3) on GenLayer StudioNet

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

### When an invoice goes unpaid

1. A day after the due date, anyone may mark the default. The buyer can still repay at any time, which ends the matter.
2. The seller, the buyer and the capital provider may each put their account on the record, twice each. Every item reaches the panel labelled with the side that wrote it.
3. Any of the three asks the panel who answers for it: the buyer, who did not pay a valid debt; the seller, whose invoice was not what it declared (nothing delivered, goods rejected for cause, the buyer had already paid the seller directly); or nobody yet.
4. The ruling waits out the invoice's challenge window. A filing in that window drops it, and the next ruling reads everything. After the window anyone makes it effective.
5. A seller found liable returns the advance plus the provider's fee, exactly, and the instrument closes. A buyer found liable repays the invoice and it settles normally. Until then the finding follows the wallet: every other invoice it is party to is told, and priced one risk class worse.

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

### Who answers for a default

The panel returns a finding and the items behind it. Whether that finding can name anyone is decided in code, by one rule seen from both sides: **a party is named liable only on something its opponent could not mint.**

| Panel says | Stands when | Otherwise |
|---|---|---|
| `SELLER_RECOURSE` | a named item was written by the seller (its own record or filing, an admission) or by the provider | `UNRESOLVED` |
| `BUYER_DEFAULT` | the buyer's wallet countersigned the debt on-chain, or a named item was written by the buyer (an admission) or by the provider | `UNRESOLVED` |
| `UNRESOLVED` | always | - |

Items a challenger added to the record corroborate neither finding: anyone but the seller may challenge, the buyer included, and the record does not keep which wallet it was. A buyer who says "I paid the seller directly" and files the only proof of it has corroborated nothing. Neither has a seller pointing at its own paperwork against a buyer who never countersigned. Both what the panel said and what the contract recorded are stored, so a reader can see the floor at work.

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
| Address | `0xF9bF8e95d61e90b6077A40c344121890ED2D62e3` |
| Deploy tx | `0x1177e00150b316673a8c89c8a8ee40d6727606ac29b7e6a9dcf63793e99838e3` |
| Version | `0.3.0` (read live from `get_config`) |
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
| `repay` | buyer wallet | exact amount owed | into custody; answers a default and clears any finding against either party |
| `file_default_evidence` | seller, buyer or provider, each for itself | - | on a defaulted invoice; twice per side; drops a ruling still in its window |
| `request_default_ruling` | seller, buyer or provider | - | one ruling per state of the record; arms the challenge window |
| `finalize_default_ruling` | anyone | - | after the window; only here does a finding reach a wallet |
| `pay_recourse` | seller | exact advance plus fee | only on a finalized ruling against the seller; credits the provider; closes the instrument |
| `prepare_settlement` | anyone | - | computes, conserves and freezes the split |
| `execute_settlement` | anyone | - | pays the prepared record, once |
| `claim` | anyone owed | - | the only external value path; ledger zeroes before transfer |
| `cancel_invoice` / `mark_expired` / `mark_defaulted` | seller / anyone / anyone | - | housekeeping with wall-clock guards |

### Read methods

`get_invoice`, `get_invoices` (paged), `get_invoices_for`, `get_evidence` (any version), `get_assessment` (any version), `get_claimable`, `get_default_filing`, `get_default_ruling`, `get_liabilities`, `get_stats`, `get_config` (every enforced bound).

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

### v0.3.0: default adjudication, in two sittings

A default cannot be hurried: the contract marks one only a full day after
the due date. So the live proof ran in two sittings on the v0.3.0 deployment
with real GEN. Sitting one (21 September) registered, judged, promoted and
funded two receivables with their due date under ninety minutes away, and
the contract refused both an early default and an early filing on-chain.
Sitting two (25 September) marked both defaulted and ran each finding where
it must fire and where it must not.

**X.** The seller filed its collection notices against a buyer whose wallet
had countersigned the debt. The panel found the buyer in default, the
contract let it stand on the countersignature, a stranger's filing and an
early finalization were refused, and after the window the buyer's wallet
carried the liability. The buyer then repaid: the liability left the wallet
and the invoice settled normally.

**Y, the control.** The buyer filed its own remittance advice claiming it
had paid the seller directly, with nothing else behind it. The panel
believed it and said the seller owed recourse. The contract recorded
UNRESOLVED and named nobody: a party is not found liable on its opponent's
paper, and both the panel's word and the recorded finding are on the
record for anyone to compare. Asking again with nothing new filed was
refused. Then the provider filed a bank confirmation, which the buyer could
not have written, and the same finding stood. After the window the seller's
wallet carried the liability; recourse was refused before the window
closed, from the buyer, and one atto short; then the seller paid the
advance plus the fee exactly, the provider was whole, the instrument
closed, the liability left the wallet, and custody ended at zero.

Reproduce with `node web/scripts/live-v030.mjs`. Transcripts:
`web/live-v030.sitting1.stdout` and `web/live-v030.sitting2.stdout`.

```text
FACTORA v0.3.0 LIVE RUN  ·  0xF9bF8e95d61e90b6077A40c344121890ED2D62e3  ·  RESUME=1790011265
  ok    the deployed contract reports version 0.3.0  (0.3.0)
Sitting one. Two receivables, judged, promoted and funded
  ok    X: registered as fac-000001  (INV-V030-X-1790011265)
  ok    Y: registered as fac-000002  (INV-V030-Y-1790011265)
  ok    X: funded  (FUNDED · advance 0.0600 GEN)
  ok    Y: funded  (FUNDED · advance 0.0600 GEN)
Sitting two. The day of grace has passed and nobody paid
X. The seller's collection notices, against a buyer who countersigned
  ok    refused: X: a stranger filing on somebody else's default  (receipt ERROR)
  ..    X: panel said BUYER_DEFAULT; the contract records BUYER_DEFAULT; behind it: DF-1-1,EV-003
  ok    X: the buyer is found in default on a debt its own wallet countersigned  (BUYER_DEFAULT)
  ok    X: inside its window the ruling names nobody yet
  ok    refused: X: finalizing the ruling inside its window  (receipt ERROR)
  ..    X: the ruling's window closes in 911s
  ok    X: after the window the buyer's wallet carries the liability  (liabilities on the wallet: 1)
  ok    X: payment answered the default and the liability left the wallet  (liabilities on the wallet: 0)
Y. CONTROL: the buyer's own remittance advice is the only thing behind its story
  ..    Y: panel said SELLER_RECOURSE; the contract records UNRESOLVED; behind it: DF-1-1
  ok    Y: the seller was NOT named on the buyer's own paper  (panel said SELLER_RECOURSE; recorded UNRESOLVED)
  ok    refused: Y: asking again with nothing new filed  (receipt ERROR)
Y. The provider files what the buyer could not mint
  ok    Y: the new filing dropped the ruling that had not read it
  ..    Y: panel said SELLER_RECOURSE; the contract records SELLER_RECOURSE; behind it: DF-1-1,DF-2-1
  ok    Y: recourse against the seller, resting on the provider's evidence  (SELLER_RECOURSE · DF-1-1,DF-2-1)
  ok    refused: Y: paying recourse before the ruling has taken effect  (receipt ERROR)
  ..    Y: the ruling's window closes in 900s
  ok    Y: after the window the seller's wallet carries the liability  (liabilities on the wallet: 1)
  ok    refused: Y: the buyer paying the seller's recourse  (receipt ERROR)
  ok    refused: Y: recourse one atto short  (receipt ERROR)
  ok    Y: the seller paid the advance plus the fee  (0.0650 GEN)
  ok    Y: the provider is whole, the instrument is closed, the liability has left the wallet
  ok    refused: Y: the buyer repaying an instrument that is closed  (receipt ERROR)
Claims
  ok    PROVIDER claimed  (0.1300 GEN)
  ok    custody is zero: every atto left through claim()  ({"invoices":2,"funded":2,"settled":1,"escrow_atto":"0"})
EVERY STEP PASSED
```

### v0.2.0: each new finding, where it must fire and where it must not

Run against the v0.2.0 deployment `0x117b03D79063F4aE882bA16B17398f4Dd49814e1` with real GEN (v0.3.0 added default adjudication and changed none of this). Four receivables, two
per feature, each pair differing in one fact: the register confirms both
parties where the documents name them and CONTRADICTS the buyer where they
name someone else; a contested part is found SUPPORTED where the delivery
record and a credit note show the shortfall, and NOT_SUPPORTED where the
record shows full delivery. Seven writes the contract must refuse were sent
and refused on-chain. The supported claim was then funded, repaid and
settled on the remainder, conserving to the atto, and custody ended at zero.
Reproduce it with `node web/scripts/live-v020.mjs <address>`.

Two things the transcript shows and does not hide. One round (control B,
first attempt) reached no majority: validators who derive a different risk
class from their own reading refuse the leader's, nothing is written, and
the round is run again, which the script does and says. And the run was
resumed once from chain state after the script was taught that retry; case
A's lines are its on-chain results read back, not judged twice.

```text
FACTORA v0.2.0 LIVE RUN  ·  0x117b03D79063F4aE882bA16B17398f4Dd49814e1  ·  RESUME=1789999192

  ok    the deployed contract reports version 0.2.0  (0.2.0)
A. Both parties are in the public register, and the documents name them
  ok    A: registered as fac-000001  (INV-V020-A-1789999192)
  ok    refused: A: a stranger naming an entity for the seller  (receipt ERROR)
  ok    refused: A: an identifier with a wrong check digit  (receipt ERROR)
  ok    refused: A: the seller naming a second entity  (receipt ERROR)
  ok    A: the panel ruled
  ..    A: FINANCEABLE · LOW · score 85 · identity {"buyer":"REGISTERED","seller":"REGISTERED"} · claim NONE
  ok    A: both parties REGISTERED by the register every validator read
  ok    A: both register records were read, active and current
  ok    A: the stored record names the buyer's entity
  ok    A: no contradiction was raised on a matching record

C. The buyer contests 8 of 40 seats, and the record shows the shortfall
  ok    C: registered as fac-000002  (INV-V020-C-1789999192)
  ok    refused: C: the seller filing the buyer's claim  (receipt ERROR)
  ok    refused: C: a claim that swallows the invoice  (receipt ERROR)
  ..    C: round 1 landed (agree,idle,disagree,agree,agree)
  ok    C: the panel ruled
  ..    C: FINANCEABLE · LOW · score 72 · identity {"buyer":"NONE","seller":"NONE"} · claim SUPPORTED
  ok    C: the panel found the claim SUPPORTED  (SUPPORTED)
  ok    C: an examined item stands behind the finding  (EV-003,EV-005)
  ok    C: the remainder is what is financed and what is owed  (0.0800 GEN / 0.0800 GEN)
  ok    C: a partial objection did not hold the whole record at review  (FINANCEABLE)

B. CONTROL: the same identifiers, but the documents name a different buyer
  ok    B: registered as fac-000003  (INV-V020-B-1789999192)
  ..    B: round 1 reached no majority (idle,disagree,disagree,disagree,idle); nothing was written, running it again
  ..    B: round 2 landed (agree,agree,disagree,agree,disagree)
  ok    B: the panel ruled
  ..    B: REVIEW_REQUIRED · HIGH · score 85 · identity {"buyer":"CONTRADICTED","seller":"REGISTERED"} · claim NONE
  ok    B: the buyer was NOT registered on a record naming someone else  (CONTRADICTED)
  ok    B: the register contradicts the named buyer
  ok    B: no terms for a record whose buyer the register contradicts  (REVIEW_REQUIRED)
  ok    B: the seller, named correctly, is still REGISTERED

D. CONTROL: the same claim, but the record shows all 40 seats delivered
  ok    D: registered as fac-000004  (INV-V020-D-1789999192)
  ..    D: round 1 landed (agree,idle,agree,disagree,agree)
  ok    D: the panel ruled
  ..    D: FINANCEABLE · MEDIUM · score 80 · identity {"buyer":"NONE","seller":"NONE"} · claim NOT_SUPPORTED
  ok    D: the claim was NOT supported on a record that shows full delivery  (NOT_SUPPORTED)
  ok    D: the contested part is still not financed  (0.0800 GEN)
  ok    D: the full invoice is still owed  (0.1000 GEN)

The challenge windows lapse; anyone promotes
  ok    A: the top table applies: countersigned, both parties registered  (FINANCEABLE · REGISTERED · 8500 bps)

C. Funded, repaid and settled on the remainder
  ok    C: countersigned on keys alone, so the middle table at the judged risk  (KEYS_ONLY · LOW · 7500 bps)
  ok    C: the advance is priced on the remainder  (0.0600 GEN)
  ok    refused: C: funding the advance of the uncontested invoice  (receipt ERROR)
  ok    refused: C: repaying the full invoice when the remainder is owed  (receipt ERROR)
  ok    C: the split conserves to the atto  (provider 0.0624 GEN · seller 0.0176 GEN)
  ok    SELLER claimed  (0.0776 GEN)
  ok    PROVIDER claimed  (0.0624 GEN)
  ok    custody is zero: every atto left through claim()  ({"invoices":4,"funded":1,"settled":1,"escrow_atto":"0"})

EVERY STEP PASSED
```

The first v0.2.0 deployment lasted an hour. Its own control case found that a
panel shown a credit claim and NO dispute named the dispute conflict anyway,
which priced a partial objection as a repudiation. The fix and the superseded
address are in `docs/DEPLOYMENT.md`. Control D above is that same record on
the corrected contract: `FINANCEABLE · MEDIUM`, where it had been held at
review.

### v0.1.2: the stewards' dispute regression

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

Test gates behind the transcripts: 214 direct tests (nine of them the
dispute-invalidation regressions, fifty-seven the v0.2.0 identity and credit
rules, thirty-six the v0.3.0 default rules, two the lapse that must not undo
money), a 150-guard mutation sweep with 11 declared-depth guards and a green
accept-control, 48 frontend tests, genvm-lint clean. The sweep runs in CI on
every push; its first full run on v0.3.0 found three guards no test failed
for, and each now has the test that kills it or a stated reason it sits
behind another. `scripts/check_app_writes.py`, also in CI, checks that every
write the app composes matches the contract's signature: all 26 are
reachable, with matching arguments and payment flags.

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
├── tests/direct/                 214 direct tests + strict genlayer stub
├── scripts/
│   ├── mutate.py                 150-guard mutation sweep + accept-control
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
python scripts/verify_deployment.py 0xF9bF8e95d61e90b6077A40c344121890ED2D62e3
```

Run the app locally: set `web/.env.local` from the table in `docs/DEPLOYMENT.md`, then `npm run dev`.

## Security

- One credit choke point (`_credit`) and one external value path (`claim`); the ledger zeroes before the transfer is emitted; custody is deposits minus claims and reconciles to zero when a book closes.
- Reserve-at-acceptance is not needed: there is no shared pool - each position escrows its own advance, and the split is conserved by assertion before it is stored.
- Prompt-injection surface: both fence delimiters are sanitized out of every party string and fetched page; URLs are printable-ASCII with the header-forging characters refused; a forged fence arrives visibly defused and weighs against its supplier.
- The subject of the judgment does not control its strongest identity evidence: the buyer countersignature and the buyer dispute are signed by the buyer's own wallet, and declared-only records cap the advance in code.
- A lapse restores an assessment's standing and never undoes money. Repayment, default and recourse stay open while a challenge is, and a status any of them wrote survives the lapse. (Until v0.3.0's pre-submission debug it did not: a repayment made under a challenge that later went stale was put back to FUNDED with the buyer's payment stranded in custody. Every earlier deployment carries that defect.)
- Challenges snapshot what they challenge; a lapse restores exactly that snapshot - then re-applies the dispute-invalidation rule, so a stale challenge is not a way to sneak a repudiated verdict back into effect - and an unresolved challenge has a permissionless wall-clock exit.
- Known limitation, stated: the protocol holds no seller collateral, so it cannot manufacture a recovery. A default ruling names who answers for the loss; it cannot make them pay. `pay_recourse` is the liable seller's exit and `repay` the liable buyer's, and until one is used the only pressure is the finding that follows the wallet into its other invoices. Off-chain document authenticity (a forged PDF pasted as text) is bounded by the countersignature cap, not solved.

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
