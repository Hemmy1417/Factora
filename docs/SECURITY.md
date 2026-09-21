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
  under consensus with digests over the stored excerpt, and since v0.2.0
  every stored byte of a fetched page must be text the validator fetched
  itself: the leader's excerpt is a prefix of, or equal to, the validator's
  own. An honest page with a fabricated ending behind a correct digest is
  refused. The cost is stated: a leader whose render ran longer is refused
  too, and the round is run again.
- The subject of the judgment does not choose the source that vouches for
  its identity (v0.2.0). A party names an identifier; the register's address
  comes from a fixed table in the contract; every validator fetches the
  record itself; both nodes keep the same canonical subset of it, so the
  stored bytes must be equal, not merely compatible; and the identity class
  is derived in code. The signer is the party: nobody attests for anybody
  else, an identifier is written once, its check digits are verified in
  code, and one entity cannot sit on both sides of an invoice.
- Every floor has its mirror, and both are tested.

  | One side's self-serving input | cannot | because |
  |---|---|---|
  | a party's own documents, or a model volunteering MATCH | lift that party to REGISTERED | with no attestation the panel is never asked, and the class is NONE |
  | a model naming `ENTITY_CONTRADICTED`, or answering MISMATCH for a side that attested nothing | sink the other party to CONTRADICTED | the code is contract-owned, stripped from the model's list, and derived only from a register record this node read |
  | the buyer's statement alone | cut the debt (`SUPPORTED`) | the finding needs an examined item named behind it, or it falls to INSUFFICIENT |
  | the absence of a rebuttal alone | mark the buyer as contesting against the evidence (`NOT_SUPPORTED`) | the same rule, from the other side |

- A default is adjudicated, and nobody is found liable on their opponent's
  paper (v0.3.0). The panel returns a finding and the items behind it;
  `_default_finding` decides in code whether it can stand. `SELLER_RECOURSE`
  needs a named item the buyer did not write. `BUYER_DEFAULT` needs the
  buyer's on-chain countersignature or a named item the seller did not
  write. Anything less is `UNRESOLVED` and names nobody. Both the panel's
  word and the recorded finding are stored. Validators compare the recorded
  finding, so two panels that disagree in words but land together after the
  floor agree; and a validator re-applies the floor to the leader's own
  stated word and items, so a leader cannot record more than it floored.
- A ruling assigns nothing when it lands. It waits out the invoice's
  challenge window, a filing in that window drops it, the same state of the
  record cannot be ruled on twice, and every hold has an exit: the buyer can
  always repay, which clears a finding against either party, and a seller
  found liable can always pay recourse.
- A finding reaches a wallet in exactly one place (`_set_liable`), so the
  count per wallet cannot drift from the invoices that justify it, and it
  leaves the same way. While it stands, it follows the wallet into every
  other assessment as a contract-owned conflict code.
- A buyer's objection is read exactly as it stands. A credit claim filed
  after a judgment strikes that judgment's effect, as a dispute does. So
  does a claim the panel read that has since been replaced by a larger one,
  and so does a claim the panel priced that has since been WITHDRAWN: terms
  that finance and collect a reduced amount must not outlive the claim that
  reduced it.
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
- The provider's evidence counts as independent in a default, in both
  directions. A provider is the party out of pocket and gains from SOME
  finding, not from a particular one, but a provider colluding with one side
  could file for it. The floor stops a party being named on its opponent's
  paper; it does not stop two parties agreeing on a story.
- The floor checks who WROTE a named item, not whether the item is relevant.
  Relevance is the panel's judgment, and validators must land on the same
  recorded finding for it to stand.
- A finding that follows a wallet is an on-chain fact about that wallet on
  this contract only. A party can act through a fresh wallet; what it cannot
  do is carry the old wallet's countersigned history with it.
- The register confirms a company, not a key. `REGISTERED` means the entity
  exists, is active, and is the party the committed documents name. It does
  not mean the wallet belongs to that entity: a seller who controls a second
  wallet can name a real company's identifier for it. The register holds no
  field that binds an identifier to a wallet, so this is priced (a tier, not
  a guarantee) and stated rather than closed.
- One register. Entities without a Legal Entity Identifier cannot reach the
  top table; they are priced on keys, exactly as before v0.2.0. The table of
  registers is the extension point.
- After funding, a credit claim flags the position for monitoring and
  changes nothing else: the amount owed was fixed by the judgment in effect
  when the money moved.
- Document authenticity is bounded, not solved: a forged PDF pasted as
  text is still a seller declaration. The countersignature cap and the
  tribunal's provenance weighing price that honestly rather than
  pretending to verify it.
- StudioNet finality lags acceptance by tens of seconds; the frontend
  says **Accepted** and **Finalized** separately and proves each claim
  differently.
- The read proxy's pacing is per serverless instance — a mitigation for
  the read budget, not a guarantee of it.
