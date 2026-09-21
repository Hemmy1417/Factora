# Deployment

Factora runs on **GenLayer StudioNet** (chain id `61999`). One contract, no
server. Everything below is reproducible from a clean checkout.

## 1. What gets deployed

| | |
|---|---|
| Source | `contracts/factora.py` |
| Runner | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (pinned) |
| Constructor args | none |
| Owner / admin | **none** — `__init__` sets four counters and nothing else |
| Public methods | 37 (11 view, 26 write, 4 payable) |

There is no owner key, no pause switch, no upgrade hook, no privileged
withdrawal. Every recovery path — expiry, default, stale challenges,
settlement — is permissionless rules.

## 2. Pre-deploy gate

All four must be green. No exceptions.

```bash
python -m pytest tests/direct -q
```
```bash
genvm-lint check contracts/factora.py --json
```
```bash
python scripts/mutate.py
```
```bash
cd web && npm run typecheck && npm run lint && npm test && npm run build
```

Note on the mutation sweep: run it directly, not through a pipe — `$?`
after a pipe is the tail's exit code, and a sweep that failed would read
as green.

## 3. Deploy

```bash
genlayer deploy --contract contracts/factora.py --rpc https://studio.genlayer.com/api
```

The deploying account pays the fee and gains nothing else.

### Current deployment

| | |
|---|---|
| Network | GenLayer StudioNet (`61999`) |
| Address | `0xF9bF8e95d61e90b6077A40c344121890ED2D62e3` |
| Deploy tx | `0x1177e00150b316673a8c89c8a8ee40d6727606ac29b7e6a9dcf63793e99838e3` |
| Version | `0.3.0` (read live from `get_config`) |

### Superseded deployments

Listed rather than quietly forgotten — an address that once appeared
anywhere will outlive the moment.

| Address | Why it was replaced |
|---|---|
| `0xC0398ad8EfAa523e73B7E12085117eEc4d65F4F8` | The first v0.3.0 deployment (deploy tx `0x1dc4d48bc0e67299db676bf612a416b3b517a54a757e85c9da770e8e890af741`), replaced the same day by the pre-submission debug. Two defects, both described in `docs/SECURITY.md`: a stale challenge's lapse could put FUNDED back over a repayment made while it was open, stranding the buyer's money in custody (older than v0.3.0, present in every earlier deployment too); and a buyer's challenge evidence was read as the seller's own admission in a default ruling. Two receivables were funded there for the default proof and remain readable; the proof was re-seeded on the corrected contract. |
| `0x117b03D79063F4aE882bA16B17398f4Dd49814e1` | v0.2.0 (deploy tx `0x662a870268c57322a447bededcdcdf9b8893f58d9245f8d6bae74c4eae258b77`): registrar-attested identity and the buyer's partial objection. Its four-receivable live run, with a negative control for each finding, is recorded in the README and remains readable there. Superseded by v0.3.0, which adds default adjudication and changes none of what that run proved. |
| `0x7b1BC610ef36f77CDa07e18bf534980D592aE16A` | The first v0.2.0 deployment (deploy tx `0xea362e98bb1426591962d7932e0b0339debd3485221841109172f77ed426b96d`), replaced within the hour by what its own live control found. Shown a buyer's credit claim and NO dispute, the panel named the `BUYER_DISPUTE_OPEN` conflict anyway; with a contradicted claim that made two hard conflicts and held a partial objection at review, which is the one thing a partial objection exists not to do. The code is a chain fact, so the contract now owns it: it is no longer offered to the model, is stripped if named, and is added only when a dispute is open. The four receivables judged there remain readable. |
| `0x5755D21345f0Ea0BaD1909FC320562D41c9c2aE5` | v0.1.2, the deployment a reviewer confirmed the buyer-dispute protection on (deploy tx `0xedb264ec144e5aaefbc033439fa2e1bb39b4085adfa87391839d92cb46b97bfe`). Superseded by v0.2.0, which adds registrar-attested identity, the buyer's partial objection, and the rule that every stored byte of a fetched page is text the validator fetched itself. Its record, the dispute regression arc included, remains readable there. |
| `0x91A4dDa98B0fb5612700E41e1260Be6D851944c5` | v0.1.0. Its first live panel round returned UNDETERMINED: the model was asked for the decision and the risk class directly and validators were required to word-match them, which five independent models will not reliably do. v0.1.1 shrinks the model's surface to the three evidence pillars and derives both money fields in code — see docs/ADJUDICATION.md. |
| `0x92Bd3E1C5c78712B661c3D700cFcc5a70e075b81` | v0.1.1 built from a working copy whose line endings had drifted to CRLF, so a fresh clone (git checks out LF) could never byte-verify it. Redeployed from normalized LF bytes. The failure a byte-verifier exists to catch. |
| `0x0c54C840c72024c4e98c63A21B6f38F08516B507` | v0.1.2 deployed from a working copy whose line endings had drifted to CRLF — the same failure the `0x92Bd…` row records, recurring because the byte-verifier's universal-newline reads normalized BOTH sides and masked it. The verifier now refuses a working copy containing a single CR, and `.gitattributes` pins the tree to LF. The stewards' regression arc ran and settled on this deployment (fac-000001, custody zero) before the defect was caught; its state remains readable there, and the current deployment is character-identical after normalization. |
| `0xE2B4A382b040619779286fa808138A423B10C88a` | v0.1.1, the first fully live deployment — its settled demo arc (fac-000003, two preserved assessments, custody zero) remains readable at this address; instruments do not migrate. Superseded by v0.1.2 after the stewards' letter: a buyer dispute filed AFTER a judgment now deterministically strikes that judgment's effect (pending or effective), blocks finalization and funding until a reassessment reads it, survives a challenge-lapse snapshot restore, and gains an honest exit — the buyer can withdraw, keeping the history on the record. |

## 4. Verify the deployed bytes match this source

```bash
python scripts/verify_deployment.py 0xF9bF8e95d61e90b6077A40c344121890ED2D62e3
```

Reads the live code back, compares character for character, checks the
version in `get_config` against the source header, and checks the callable
surface. Exit code 0 only if all three hold.

Verified for the current deployment:

```text
  code      BYTE-MATCH (137619 characters)
  version   0.3.0 on-chain, 0.3.0 in the source header
  schema    11 view, 26 write, 4 payable (challenge, fund, pay_recourse, repay)
```

## 5. Wire the frontend

`web/.env.local` (and the same variables in the host's project settings —
they compile into the bundle, so set them BEFORE the first build):

```text
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5755D21345f0Ea0BaD1909FC320562D41c9c2aE5
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999
GENLAYER_RPC_URL=https://studio.genlayer.com/api
```

For a hosted deployment (e.g. Vercel): Root Directory = `web`, then the
four variables above, then build.

## 6. The live proof

```bash
cd web && node scripts/live-demo.mjs 0x5755D21345f0Ea0BaD1909FC320562D41c9c2aE5
```

Runs the whole arc with real GEN — register, commit, countersign, panel,
refusal probes, window, finalize, fund, claim, dispute, challenge,
reassess, repay, prepare, execute, claims, custody-to-zero — and exits 0
only if every step lands and every refusal refuses. The recorded transcript
of the accepted run lives in the README.
