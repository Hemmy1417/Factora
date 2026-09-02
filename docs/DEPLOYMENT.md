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
| Public methods | 26 (8 view, 18 write, 3 payable) |

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
| Address | `0x5755D21345f0Ea0BaD1909FC320562D41c9c2aE5` |
| Deploy tx | `0xedb264ec144e5aaefbc033439fa2e1bb39b4085adfa87391839d92cb46b97bfe` |
| Version | `0.1.2` (read live from `get_config`) |

### Superseded deployments

Listed rather than quietly forgotten — an address that once appeared
anywhere will outlive the moment.

| Address | Why it was replaced |
|---|---|
| `0x91A4dDa98B0fb5612700E41e1260Be6D851944c5` | v0.1.0. Its first live panel round returned UNDETERMINED: the model was asked for the decision and the risk class directly and validators were required to word-match them, which five independent models will not reliably do. v0.1.1 shrinks the model's surface to the three evidence pillars and derives both money fields in code — see docs/ADJUDICATION.md. |
| `0x92Bd3E1C5c78712B661c3D700cFcc5a70e075b81` | v0.1.1 built from a working copy whose line endings had drifted to CRLF, so a fresh clone (git checks out LF) could never byte-verify it. Redeployed from normalized LF bytes. The failure a byte-verifier exists to catch. |
| `0x0c54C840c72024c4e98c63A21B6f38F08516B507` | v0.1.2 deployed from a working copy whose line endings had drifted to CRLF — the same failure the `0x92Bd…` row records, recurring because the byte-verifier's universal-newline reads normalized BOTH sides and masked it. The verifier now refuses a working copy containing a single CR, and `.gitattributes` pins the tree to LF. The stewards' regression arc ran and settled on this deployment (fac-000001, custody zero) before the defect was caught; its state remains readable there, and the current deployment is character-identical after normalization. |
| `0xE2B4A382b040619779286fa808138A423B10C88a` | v0.1.1, the first fully live deployment — its settled demo arc (fac-000003, two preserved assessments, custody zero) remains readable at this address; instruments do not migrate. Superseded by v0.1.2 after the stewards' letter: a buyer dispute filed AFTER a judgment now deterministically strikes that judgment's effect (pending or effective), blocks finalization and funding until a reassessment reads it, survives a challenge-lapse snapshot restore, and gains an honest exit — the buyer can withdraw, keeping the history on the record. |

## 4. Verify the deployed bytes match this source

```bash
python scripts/verify_deployment.py 0x5755D21345f0Ea0BaD1909FC320562D41c9c2aE5
```

Reads the live code back, compares character for character, checks the
version in `get_config` against the source header, and checks the callable
surface. Exit code 0 only if all three hold.

Verified for the current deployment:

```text
  code      BYTE-MATCH (78236 characters)
  version   0.1.1 on-chain, 0.1.1 in the source header
  schema    8 view, 18 write, 3 payable (challenge, fund, repay)
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
