# Architecture

One intelligent contract, one frontend, no backend. The contract is the only
authority; the frontend is a lens that reads it and a pen that signs to it.

```text
Browser (Next.js, the laboratory)
   │  genlayer-js · EIP-6963 wallet · provider-injected write client
   ▼
/api/rpc  — same-origin paced proxy (reads + one tx-status lookup only)
   ▼
GenLayer StudioNet
   ▼
contracts/factora.py — registry · evidence · tribunal · capital rails
```

## The boundary

| Owner | Owns |
|---|---|
| Contract | invoice registry and identity, evidence versions and roots, the assessment tribunal and its recorded dossiers, the deferral gate, funding custody, repayment, the settlement split, the claim ledger, every window |
| Frontend | rendering authoritative state, composing writes, wallet discovery, the finality watch, read pacing and caching |
| Nobody | there is no owner key, no operator, no backend database, no privileged path |

## Storage

Flat dataclass rows in `TreeMap`s, JSON strings for anything list-shaped
(`DynArray` cannot be constructed in contract code — a sibling learned that
live). Evidence manifests and assessment dossiers are immutable JSON records
keyed `invoice_id|version`; nothing overwrites them. Per-actor indices are
maintained incrementally so every view reads a bounded slice — no view scans
the world.

## The write → confirm contract (read this before touching the frontend)

Every write in the app closes the same way, and the frontend never invents a
transition:

1. `writeAndConfirm` submits through the connected wallet's provider-backed
   client.
2. It polls an ANCHORED view predicate — "is the thing I asked for now true
   for ME" — never a receipt alone, never an un-anchored count.
3. When the predicate holds the stepper says **Accepted**: the state is
   live, and the flow unblocks.
4. A detached, bounded watch then polls the transaction itself and says
   **Finalized** only on `FINALIZED` status with a successful deciding
   leader receipt (`consensus_data.leader_receipt[0]`). Measured live: a
   REFUSED write also finalizes with consensus result `MAJORITY_AGREE` —
   the panel agreed it errored — so the consensus result is never consulted.
5. Which predicate confirms which write lives in `web/lib/predicates.ts`,
   one function per question, injectable for tests.

| Write | Predicate |
|---|---|
| `create_invoice` | the seller's invoice list grew past its snapshot |
| `commit_evidence` | `evidence_version == previous + 1` |
| `acknowledge_invoice` / `file_buyer_dispute` | the epoch field is set |
| `request_assessment` | status `PENDING_FINALITY` at the requested version |
| `finalize_assessment` | `assessed_version == pending` and status moved |
| `fund` | status `FUNDED` **and** `provider == me` |
| `repay` / `prepare_settlement` / `execute_settlement` | the named status |
| `challenge` / `reassess` / `challenge_lapse` | `challenge_open` flipped |
| `claim` / `claim_advance` | the claimable balance drained to zero |

## Reads

StudioNet allows ~30 reads/min/IP (measured on a sibling). All reads travel
a same-origin proxy that paces, coalesces and caches; its allowlist forwards
exactly two things — `gen_call` reads against this one contract, and
`eth_getTransactionByHash` for a strictly-validated hash — so publishing it
hands nobody a relay.

## The lifecycle in one paragraph

An invoice registers with a hashed identity (duplicates refuse), commits
evidence as canonical bytes (append-only versions), and goes to the panel at
the seller's request — once per version, so verdict-shopping is structural
nonsense. The verdict arms a challenge window and assigns nothing until
`finalize_assessment` promotes it. Funding must equal the derived advance
exactly and forwards it to the seller's claim balance. The buyer — only the
buyer wallet — repays in full into custody. Settlement is prepare (compute,
conserve, freeze) then execute (pay the frozen record, once). Challenges
bond, append evidence as the next version, genuinely re-run the panel, and
carry a snapshot a stale-lapse restores verbatim.
