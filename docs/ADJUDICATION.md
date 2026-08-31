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

A validator whose own rerun throws **disagrees** instead of throwing —
a broken model rotates the round rather than discarding it. Leader errors
compare by taxonomy: deterministic refusals must match exactly, transient
noise agrees with transient noise, model misbehaviour always disagrees.

## Terms

`_promote()` prices the promoted verdict against a code table on
(risk, buyer-acknowledged): LOW 85% / MEDIUM 70% advance with a 3% / 5%
fee — capped at 60% / 50% when the buyer never countersigned, because a
declared-only record is priced as one. The dossier carries an advisory copy
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
