# Security model

## Money invariants (tested, mutation-pinned)

- One credit choke point (`_credit`), one external value path (`claim`).
  The ledger zeroes before the transfer is emitted. Custody is deposits
  minus claims; a closed book reconciles to zero and the suite proves it.
- Funding must equal the state-derived advance exactly; repayment must
  equal the invoice amount exactly; the caller chooses WHEN, never how
  much.
- The settlement split is computed once, asserted to conserve
  (`provider_total + seller_total == repaid`), frozen, and executed once.
  `SETTLED` is terminal — every verb bounces off it (tested as the S30
  post-terminal class).
- Two providers racing one position: the second refuses with its value
  untouched. Two challengers racing one record: the second refuses.

## The judgment cannot be bought at the edges

- One assessment per evidence version — re-rolling the same record for a
  kinder panel is structurally impossible.
- The verdict assigns nothing until its challenge window lapses; promotion
  is a separate permissionless step; funding, promotion and settlement all
  refuse while a challenge is open.
- A challenge appends evidence (history preserved), snapshots what it
  challenges, and a stale challenge has a permissionless wall-clock exit
  that restores that snapshot verbatim and frees the bond — nothing is
  hostage to a round that never lands.
- Bond allocation is deterministic: changed verdict or risk → returned;
  otherwise forfeited to the party the noise burdened.

## Identity and evidence

- The subject of the judgment does not control its strongest identity
  evidence: the buyer countersignature and the buyer dispute are signed by
  the buyer's own wallet, and an unacknowledged record caps the advance in
  code whatever the panel thought.
- Evidence is committed bytes: canonical manifest, per-item sha256, root
  on-chain. A changed byte is a different version. Fetched pages arrive
  under consensus with digests over the stored excerpt.
- Prompt injection: both fence delimiters defused in every party string,
  URL charset closed against header forgery, provenance labels per fence,
  guardrails that name the mechanism honestly.

## The clock

Three wall-clock candidates (mutual divergence refused), an execution-layer
corroboration floor, and two beacon heads bounding both directions — a
common forward skew of one edge network cannot close windows early. No
witness, no clock: every timed method fails closed.

## Known limitations, stated

- No seller collateral in the MVP: a default records the provider's loss;
  it cannot manufacture a recovery.
- Document authenticity is bounded, not solved: a forged PDF pasted as
  text is still a seller declaration. The countersignature cap and the
  tribunal's provenance weighing price that honestly rather than
  pretending to verify it.
- StudioNet finality lags acceptance by tens of seconds; the frontend
  says **Accepted** and **Finalized** separately and proves each claim
  differently.
- The read proxy's pacing is per serverless instance — a mitigation for
  the read budget, not a guarantee of it.
