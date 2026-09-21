# Adjudication

The financeability tribunal, exactly as the contract runs it.

## What the panel is given

- The invoice facts (parties, reference, amount, dates) — defanged.
- Chain-verified facts, labelled as such: whether the buyer's wallet
  countersigned the obligation, and any open buyer dispute (rendered
  verbatim inside its own fence).
- Every committed evidence item, one fence each, with its provenance in the
  fence header: `SELLER-DECLARED DOCUMENT` (committed bytes; a party's
  claim, not a verified fact) or `CONTRACT-FETCHED PAGE` (retrieved by the
  contract itself, under consensus, at judgment time).

## What the panel returns

Three pillar findings (`seller`, `buyer`, `transaction` — each `SUPPORTED`
/ `NOT_SUPPORTED` / `INSUFFICIENT`), conflict codes from a fixed
vocabulary, the examined/excluded partition of the committed set, a 0-100
score, and two sentences of reasoning.

**It does not return a decision. It does not return a risk class. It never
sees a basis point.**

Two further findings are asked only when the record calls for them
(v0.2.0), and each is phrased as the observable fact required, not as an
impression:

- `seller_entity_match` / `buyer_entity_match`, asked only for a side whose
  wallet attested an entity AND whose register record this node fetched and
  found active and current. `MATCH` only when the committed documents name
  that party and the name denotes the same legal entity as the register's
  legal name or one of its other names; `MISMATCH` when the documents name a
  different entity; `UNCLEAR` when they do not name the party well enough to
  tell. The identity class (`NONE`, `DECLARED`, `REGISTERED`,
  `CONTRADICTED`) is then composed in code by `_entity_class`.
- `credit_claim_finding` and `credit_corroboration`, asked only while a
  buyer's credit claim is open. `SUPPORTED` only when an item the panel
  names itself shows the shortfall; `NOT_SUPPORTED` only when a named item
  affirmatively contradicts the claim; otherwise `INSUFFICIENT`. Named items
  that were not examined are dropped in code, and a finding left with none
  behind it falls to `INSUFFICIENT`.

## The derivation

`_derive_verdict` — pure code, executed identically inside every
validator's own judgment — composes the two fields money reads:

```text
any pillar NOT_SUPPORTED                          → NOT_FINANCEABLE
else: open buyer dispute, nothing examined,
      transaction pillar INSUFFICIENT,
      or two-plus hard conflicts                  → REVIEW_REQUIRED
else                                              → FINANCEABLE

risk: HIGH   on any NOT_SUPPORTED or two-plus hard conflicts
      MEDIUM on any INSUFFICIENT or exactly one hard conflict
      LOW    otherwise
```

Hard conflicts are the codes that steer the derivation
(`AMOUNT_MISMATCH`, `PARTY_MISMATCH`, `DUPLICATE_INDICATION`,
`DELIVERY_CONTRADICTED`, `PAYMENT_TERMS_CONFLICT`, `BUYER_DISPUTE_OPEN`,
`EXTERNAL_CONTRADICTION`); an open buyer dispute enters the set
deterministically, not at the model's discretion. Soft codes inform the
reader and stay outside consensus.

## The equivalence rule

Every validator re-reads the committed bytes, re-fetches the frozen URLs,
judges independently, derives its own decision and risk, then compares:

| Field | Rule | Why |
|---|---|---|
| derived decision | exact | it moves money |
| derived risk | exact | it prices the advance and the fee |
| pillar findings | within one ladder step each | two honest readings of one record differ by a step; two steps is a different record — and any material swing already flips a derived field |
| hard-conflict set | exact | it steers the derivation |
| examined id set | exact | examination accountability is part of the verdict |
| score | bucket of ten, within one | recorded as the leader's figure, bucket-agreed |
| dossier rows | structural | ids in order, reachability claims, each digest re-derived from the bytes that row stores; declared-document excerpts must equal the committed bytes |
| fetched-page excerpts | the leader's is a prefix of, or equal to, this node's | every stored byte is text a validator fetched; a longer leader excerpt could carry a fabricated ending |
| register records | exact bytes | both nodes keep the same canonical subset of the record and drop its volatile envelope, so honest nodes store identical text |
| identity classes | exact | they choose the advance table and can hold the record at review |
| credit claim finding | exact | it decides what the buyer owes |

A validator whose own rerun throws **disagrees** instead of throwing —
a broken model rotates the round rather than discarding it. Leader errors
compare by taxonomy: deterministic refusals must match exactly, transient
noise agrees with transient noise, model misbehaviour always disagrees.

## Terms

`_promote()` prices the promoted verdict against a code table on risk and
an identity tier chosen by `_advance_table`: LOW 85% / MEDIUM 70% when the
buyer countersigned AND both parties are `REGISTERED`; 75% / 60% when the
buyer countersigned and identity rests on wallet keys; 60% / 50% when the
buyer never countersigned, because a declared-only record is priced as one.
The fee is 3% / 5%. Advance and fee are computed on the financed base from
`_credit_terms`: the invoice, less any part the buyer contested in the
judged record. What the buyer owes is that base when the claim was found
`SUPPORTED`, and the full invoice otherwise. The dossier carries an advisory copy
for display; promotion recomputes and never trusts it.

## Injection posture

Both fence delimiters are sanitized out of every party string and fetched
page, so every intact fence was emitted by the contract; a typed
counterfeit arrives visibly defused and weighs against its supplier. URLs
are printable ASCII with `| < > " ' `` ` `` refused — the fence header is a
pipe-delimited field list and stays the contract's own. The guardrails tell
the panel all of this honestly, including what the sanitizer actually does.

## Accountability

`examined + excluded == committed`, enforced as arithmetic; an unreachable
page can be excluded, never examined; every count lands in the dossier; and
the dossier's rows carry digests over the exact bytes stored, so the
examined record stays auditable forever.

## The default ruling (v0.3.0)

A second, separate judgment, asked only on a defaulted invoice.

**Given:** the chain facts (what was owed and when, the advance, that no
repayment reached the contract, whether the buyer countersigned, any open
dispute or credit claim), the committed documents of the assessed version as
`ORIGINAL RECORD`, and every `DEFAULT FILING`, each fence naming the side that
wrote it. Original pages fetched at assessment are not refetched.

**Returned:** `default_finding` (`BUYER_DEFAULT`, `SELLER_RECOURSE`,
`UNRESOLVED`), the ids of the items behind it, and reasoning, which comes
first in the schema. Each finding is phrased as the observable fact required.

**Derived in code:** `_default_finding` applies the floor and its mirror (see
SECURITY.md). Items the panel names that are not on the record are dropped
before the floor runs.

**Compared:** the recorded finding, exactly, after the floor; the record rows
(ids, authors, digests), exactly, because they are storage and identical for
every node; and the leader's own consistency, by re-applying the floor to the
leader's stated word and items. Prose is never compared.
